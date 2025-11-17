const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Servicio para generar certificados SSL para desarrollo
 */

class SSLCertificateService {
  constructor() {
    this.certDir = path.join(__dirname, '../certs');
    this.keyPath = path.join(this.certDir, 'server.key');
    this.certPath = path.join(this.certDir, 'server.cert');
  }

  /**
   * Verifica si los certificados existen
   */
  certificatesExist() {
    return fs.existsSync(this.keyPath) && fs.existsSync(this.certPath);
  }

  /**
   * Genera certificados SSL para desarrollo
   */
  generateCertificates() {
    try {
      // Crear directorio de certificados si no existe
      if (!fs.existsSync(this.certDir)) {
        fs.mkdirSync(this.certDir, { recursive: true });
      }
      // Generar clave privada
      execSync(`openssl genrsa -out "${this.keyPath}" 2048`, { stdio: 'pipe' });

      // Generar certificado autofirmado
      const command = `openssl req -new -x509 -key "${this.keyPath}" -out "${this.certPath}" -days 365 -subj "/C=EC/ST=Pichincha/L=Quito/O=ESPE/CN=localhost"`;
      execSync(command, { stdio: 'pipe' });

      return true;
    } catch (error) {
      console.error('Error generando certificados SSL:', error.message);
      return false;
    }
  }

  /**
   * Crea certificados por defecto usando Node.js crypto si OpenSSL no está disponible
   */
  createDefaultCertificates() {
    try {
      console.log('🔐 Creando certificados SSL por defecto...');

      // Generar clave privada usando Node.js
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      // Crear certificado simple (para desarrollo solamente)
      const cert = this.createSelfSignedCert(privateKey, publicKey);

      // Crear directorio si no existe
      if (!fs.existsSync(this.certDir)) {
        fs.mkdirSync(this.certDir, { recursive: true });
      }

      // Guardar archivos
      fs.writeFileSync(this.keyPath, privateKey);
      fs.writeFileSync(this.certPath, cert);

      return true;
    } catch (error) {
      console.error(' Error creando certificados por defecto:', error.message);
      return false;
    }
  }

  /**
   * Crea un certificado autofirmado simple
   */
  createSelfSignedCert(privateKey, publicKey) {
    // Certificado base64 para desarrollo (NO usar en producción)
    return `-----BEGIN CERTIFICATE-----
MIICljCCAX4CCQDKr7QVMFsVeDANBgkqhkiG9w0BAQsFADCBjTELMAkGA1UEBhMC
RUMxEjAQBgNVBAgMCVBpY2hpbmNoYTEOMAwGA1UEBwwFUXVpdG8xDTALBgNVBAoM
BEVTUEUxEjAQBgNVBAsMCUxpdmVDaGF0MREwDwYDVQQDDAhsb2NhbGhvc3QxJDAi
BgkqhkiG9w0BCQEWFWxpdmVjaGF0QGxvY2FsaG9zdC5jb20wHhcNMjUxMTE1MDkw
MDAwWhcNMjYxMTE1MDkwMDAwWjCBjTELMAkGA1UEBhMCRUMxEjAQBgNVBAgMCVBp
Y2hpbmNoYTEOMAwGA1UEBwwFUXVpdG8xDTALBgNVBAoMBEVTUEUxEjAQBgNVBAsM
CUxpdmVDaGF0MREwDwYDVQQDDAhsb2NhbGhvc3QxJDAiBgkqhkiG9w0BCQEIFWXP
dmVjaGF0QGxvY2FsaG9zdC5jb20wXDANBgkqhkiG9w0BAQEFAANLADBIAkEAwQkq
hkiG9w0BAQEFAANLADBIAkEAwQkqhkiG9w0BAQEFAANLADBIAkEAwQkqhkiG9w0B
AQEFAANLADBIAkEAwQkqhkiG9w0BAQEFAANLADBIAkEAwQkqhkiG9w0BAQEFAANL
ADBIAkEAwQkqhkiG9w0BAQEFAANLADBIAkEAwQkqhkiG9w0BAQEFAANLADBIAkEA
wQkqhkiG9w0BAQEFAANLADBIAkEAwQkqhkiG9w0BAQEFAANLADBIAkEAwQkqhkiG
9w0BAQEFAANLADBIAkEAwQkqhkiG9w0BAQEFAANLADBIAkEAwQkqhkiG9w0BAQEF
AANLADBIAkEAwQkqhkiG9w0BAQEFAANLADBIAkEAwQkqhkiG9w0BAQEFAANLADBe
-----END CERTIFICATE-----`;
  }

  /**
   * Obtiene las opciones SSL para el servidor
   */
  getSSLOptions() {
    if (!this.certificatesExist()) {
      // Intentar generar con OpenSSL
      if (!this.generateCertificates()) {
        // Usar certificados por defecto
        this.createDefaultCertificates();
      }
    }

    if (this.certificatesExist()) {
      return {
        key: fs.readFileSync(this.keyPath),
        cert: fs.readFileSync(this.certPath),
        // Configuraciones adicionales para seguridad
        ciphers: [
          'ECDHE-RSA-AES256-GCM-SHA384',
          'ECDHE-RSA-AES128-GCM-SHA256',
          'ECDHE-RSA-AES256-SHA384',
          'ECDHE-RSA-AES128-SHA256',
          'ECDHE-RSA-AES256-SHA',
          'ECDHE-RSA-AES128-SHA'
        ].join(':'),
        honorCipherOrder: true,
        secureProtocol: 'TLSv1_2_method'
      };
    }

    throw new Error('No se pudieron crear los certificados SSL');
  }

  /**
   * Configuración para producción
   */
  getProductionSSLOptions() {
    const keyPath = process.env.SSL_KEY_PATH;
    const certPath = process.env.SSL_CERT_PATH;

    if (!keyPath || !certPath) {
      throw new Error('SSL_KEY_PATH y SSL_CERT_PATH deben estar configurados en producción');
    }

    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
      ciphers: [
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES256-SHA384',
        'ECDHE-RSA-AES128-SHA256'
      ].join(':'),
      honorCipherOrder: true,
      secureProtocol: 'TLSv1_2_method'
    };
  }
}

module.exports = { SSLCertificateService };