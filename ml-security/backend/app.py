"""
Vulnerability Detection API - Production
Deteccion y clasificacion de vulnerabilidades en codigo fuente
"""

from flask import Flask, request, jsonify
import pickle
import numpy as np
from pathlib import Path
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

# Rutas
PROJECT_ROOT = Path(__file__).parent.parent
MODELS_DIR = PROJECT_ROOT / 'models'

# Variables globales para modelos
models = {}


def load_models():
    """Carga todos los modelos necesarios"""
    global models
    
    try:
        paths = {
            'detector': MODELS_DIR / 'vulnerability_detector.pkl',
            'vectorizer_detector': MODELS_DIR / 'vectorizer_detector.pkl',
            'lang_encoder': MODELS_DIR / 'language_encoder.pkl',
            'cwe_classifier': MODELS_DIR / 'cwe_classifier.pkl',
            'vectorizer_cwe': MODELS_DIR / 'vectorizer_cwe_classifier.pkl',
            'cwe_encoder': MODELS_DIR / 'cwe_encoder.pkl'
        }
        
        for name, path in paths.items():
            if not path.exists():
                raise FileNotFoundError(f"Modelo no encontrado: {path}")
            with open(path, 'rb') as f:
                models[name] = pickle.load(f)
        
        logger.info(f"Modelos cargados exitosamente: {list(models.keys())}")
        return True
        
    except Exception as e:
        logger.error(f"Error cargando modelos: {e}")
        return False


@app.route('/health', methods=['GET'])
def health():
    """Verificar salud de la API"""
    return jsonify({
        'status': 'OK',
        'models_loaded': len(models) == 6
    }), 200


@app.route('/detect', methods=['POST'])
def detect():
    """Detectar si el codigo es vulnerable (Modelo 1)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request JSON vacio'}), 400
        
        codigo = data.get('codigo', '').strip()
        lenguaje = data.get('lenguaje', '').strip()
        
        if not codigo or not lenguaje:
            return jsonify({'error': 'Campos codigo y lenguaje requeridos'}), 400
        
        lenguajes_validos = models['lang_encoder'].classes_.tolist()
        if lenguaje not in lenguajes_validos:
            return jsonify({'error': 'Lenguaje no soportado'}), 400
        
        X_tfidf = models['vectorizer_detector'].transform([codigo])
        X_lang = models['lang_encoder'].transform([lenguaje])
        X_combined = np.column_stack([X_tfidf.toarray(), X_lang])
        
        prediccion = models['detector'].predict(X_combined)[0]
        probabilidades = models['detector'].predict_proba(X_combined)[0]
        
        return jsonify({
            'vulnerable': int(prediccion),
            'confianza': float(max(probabilidades)),
            'seguro': float(probabilidades[0]),
            'vulnerable_prob': float(probabilidades[1])
        }), 200
        
    except Exception as e:
        logger.error(f"Error en deteccion: {e}")
        return jsonify({'error': 'Error interno'}), 500


@app.route('/classify', methods=['POST'])
def classify():
    """Clasificar tipo de vulnerabilidad (Modelo 2)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request JSON vacio'}), 400
        
        codigo = data.get('codigo', '').strip()
        
        if not codigo:
            return jsonify({'error': 'Campo codigo requerido'}), 400
        
        X_cwe = models['vectorizer_cwe'].transform([codigo])
        prediccion = models['cwe_classifier'].predict(X_cwe)[0]
        probabilidades = models['cwe_classifier'].predict_proba(X_cwe)[0]
        
        tipo_cwe = models['cwe_encoder'].inverse_transform([prediccion])[0]
        confianza = float(max(probabilidades))
        
        return jsonify({
            'tipo_vulnerabilidad': tipo_cwe,
            'confianza': confianza
        }), 200
        
    except Exception as e:
        logger.error(f"Error en clasificacion: {e}")
        return jsonify({'error': 'Error interno'}), 500


@app.route('/analyze', methods=['POST'])
def analyze():
    """Analisis completo: detectar + clasificar"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request JSON vacio'}), 400
        
        codigo = data.get('codigo', '').strip()
        lenguaje = data.get('lenguaje', '').strip()
        
        if not codigo or not lenguaje:
            return jsonify({'error': 'Campos codigo y lenguaje requeridos'}), 400
        
        lenguajes_validos = models['lang_encoder'].classes_.tolist()
        if lenguaje not in lenguajes_validos:
            return jsonify({'error': 'Lenguaje no soportado'}), 400
        
        # Deteccion
        X_tfidf = models['vectorizer_detector'].transform([codigo])
        X_lang = models['lang_encoder'].transform([lenguaje])
        X_combined = np.column_stack([X_tfidf.toarray(), X_lang])
        
        prediccion_det = models['detector'].predict(X_combined)[0]
        prob_det = models['detector'].predict_proba(X_combined)[0]
        
        resultado = {
            'vulnerable': int(prediccion_det),
            'confianza_deteccion': float(max(prob_det)),
            'tipo_vulnerabilidad': None,
            'confianza_clasificacion': None
        }
        
        # Clasificacion si es vulnerable
        if prediccion_det == 1:
            X_cwe = models['vectorizer_cwe'].transform([codigo])
            prediccion_cwe = models['cwe_classifier'].predict(X_cwe)[0]
            prob_cwe = models['cwe_classifier'].predict_proba(X_cwe)[0]
            
            tipo_cwe = models['cwe_encoder'].inverse_transform([prediccion_cwe])[0]
            resultado['tipo_vulnerabilidad'] = tipo_cwe
            resultado['confianza_clasificacion'] = float(max(prob_cwe))
        
        return jsonify(resultado), 200
        
    except Exception as e:
        logger.error(f"Error en analisis: {e}")
        return jsonify({'error': 'Error interno'}), 500


@app.route('/languages', methods=['GET'])
def languages():
    """Obtener lenguajes soportados"""
    lenguajes = models['lang_encoder'].classes_.tolist()
    return jsonify({
        'lenguajes': sorted(lenguajes)
    }), 200


@app.route('/cwe-types', methods=['GET'])
def cwe_types():
    """Obtener tipos de CWE soportados"""
    tipos_cwe = models['cwe_encoder'].classes_.tolist()
    return jsonify({
        'tipos': sorted(tipos_cwe)
    }), 200


@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    if load_models():
        app.run(host='0.0.0.0', port=5000, debug=False)
    else:
        logger.error("No se pudieron cargar los modelos")
        exit(1)

