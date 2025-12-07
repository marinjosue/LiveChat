"""
Cliente para la API de Deteccion de Vulnerabilidades
"""

import requests
from typing import Dict

class VulnerabilityDetectorClient:
    """Cliente para la API de detección de vulnerabilidades"""
    
    def __init__(self, base_url: str = "http://localhost:5000"):
        self.base_url = base_url.rstrip('/')
    
    def health(self) -> Dict:
        """Verificar estado de la API"""
        response = requests.get(f"{self.base_url}/health")
        response.raise_for_status()
        return response.json()
    
    def detect(self, codigo: str, lenguaje: str) -> Dict:
        """Detectar vulnerabilidad"""
        payload = {'codigo': codigo, 'lenguaje': lenguaje}
        response = requests.post(f"{self.base_url}/detect", json=payload)
        response.raise_for_status()
        return response.json()
    
    def classify(self, codigo: str) -> Dict:
        """Clasificar tipo de vulnerabilidad"""
        payload = {'codigo': codigo}
        response = requests.post(f"{self.base_url}/classify", json=payload)
        response.raise_for_status()
        return response.json()
    
    def analyze(self, codigo: str, lenguaje: str) -> Dict:
        """Analisis completo"""
        payload = {'codigo': codigo, 'lenguaje': lenguaje}
        response = requests.post(f"{self.base_url}/analyze", json=payload)
        response.raise_for_status()
        return response.json()
    
    def languages(self) -> list:
        """Obtener lenguajes soportados"""
        response = requests.get(f"{self.base_url}/languages")
        response.raise_for_status()
        return response.json()['lenguajes']
    
    def cwe_types(self) -> list:
        """Obtener tipos CWE"""
        response = requests.get(f"{self.base_url}/cwe-types")
        response.raise_for_status()
        return response.json()['tipos']



