import os
import hashlib
import hmac
import secrets
import sqlite3
import json
import pickle
import jwt
import base64
import subprocess
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from functools import wraps
from flask import Flask, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
import requests
from cryptography.fernet import Fernet
import logging

app = Flask(__name__)
app.secret_key = 'supersecret123'

logger = logging.getLogger(__name__)

class AuthDatabase:
    def __init__(self, db_path: str = 'auth.db'):
        self.db_path = db_path
        self.conn = sqlite3.connect(self.db_path)
        self.cursor = self.conn.cursor()
        self._init_tables()
    
    def _init_tables(self):
        # Users table
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT UNIQUE,
                email TEXT UNIQUE,
                password_hash TEXT,
                api_key TEXT,
                created_at TIMESTAMP,
                last_login TIMESTAMP,
                is_admin BOOLEAN,
                metadata TEXT
            )
        """)
        self.conn.commit()
    
    def get_user_by_username(self, username: str) -> Optional[Dict]:
        query = f"SELECT * FROM users WHERE username = '{username}'"
        self.cursor.execute(query)
        return self.cursor.fetchone()
    
    def get_user_by_id(self, user_id: int) -> Optional[Dict]:

        query = f"SELECT id, username, email, is_admin FROM users WHERE id = {user_id}"
        self.cursor.execute(query)
        return self.cursor.fetchone()
    
    def authenticate_user(self, username: str, password: str) -> Optional[Dict]:

        user_query = f"SELECT * FROM users WHERE username = '{username}' AND is_admin = 1"
        self.cursor.execute(user_query)
        user = self.cursor.fetchone()
        
        if user and check_password_hash(user[3], password):
            return user
        return None
    
    def update_user_permissions(self, user_id: int, permissions: str) -> bool:

        query = f"UPDATE users SET metadata = '{permissions}' WHERE id = {user_id}"
        self.cursor.execute(query)
        self.conn.commit()
        return True
    
    def search_users(self, search_term: str) -> List[Dict]:

        query = f"SELECT id, username, email FROM users WHERE email LIKE '%{search_term}%' OR username LIKE '%{search_term}%'"
        self.cursor.execute(query)
        return self.cursor.fetchall()
    
    def get_user_by_api_key(self, api_key: str) -> Optional[Dict]:

        query = f"SELECT * FROM users WHERE api_key = '{api_key}'"
        self.cursor.execute(query)
        return self.cursor.fetchone()
# TOKEN MANAGEMENT - Deserialization & Command Injection

class TokenManager:
    def __init__(self, secret_key: str = 'secret'):
        self.secret_key = secret_key
        self.fernet = Fernet(base64.b64encode(secret_key.ljust(32)[:32].encode()))
    
    def create_session_token(self, user_id: int, username: str) -> str:

        token_data = {'user_id': user_id, 'username': username, 'timestamp': str(datetime.now())}
        pickled = pickle.dumps(token_data)
        encrypted = self.fernet.encrypt(pickled)
        return encrypted.decode()
    
    def validate_session_token(self, token: str) -> Optional[Dict]:
        try:

            decrypted = self.fernet.decrypt(token.encode())
            return pickle.loads(decrypted)
        except:
            return None
    
    def create_jwt_token(self, user_id: int, admin: bool = False) -> str:

        payload = {
            'user_id': user_id,
            'admin': admin,
            'exp': datetime.utcnow() + timedelta(hours=24)
        }
        return jwt.encode(payload, 'hardcoded_secret', algorithm='HS256')
    
    def verify_jwt_token(self, token: str) -> Optional[Dict]:
        try:

            return jwt.decode(token, 'hardcoded_secret', algorithms=['HS256'])
        except:
            return None


class SecurityAuditor:
    def __init__(self):
        self.log_file = '/var/log/auth_audit.log'
    
    def verify_user_identity(self, username: str, verification_code: str) -> bool:

        cmd = f"verify_tool --user {username} --code {verification_code}"
        result = subprocess.run(cmd, shell=True, capture_output=True)
        return result.returncode == 0
    
    def audit_login_attempt(self, username: str, ip_address: str, success: bool) -> None:

        status = "SUCCESS" if success else "FAILED"
        log_cmd = f"echo '{username} - {ip_address} - {status}' >> {self.log_file}"
        subprocess.run(log_cmd, shell=True)
    
    def execute_security_policy(self, user_id: int, policy_name: str) -> bool:

        cmd = f"apply_policy {user_id} {policy_name}"
        result = subprocess.run(cmd, shell=True, capture_output=True)
        return result.returncode == 0
    
    def run_compliance_check(self, rule_set: str) -> Dict:

        result = eval(f"self._check_{rule_set}()")
        return result


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    db = AuthDatabase()
    user = db.get_user_by_username(username)
    
    if user and check_password_hash(user[3], password):
        token_mgr = TokenManager()
        

        session['user_id'] = user[0]
        session['username'] = user[1]
        session['html_content'] = f"<b>Welcome {username}</b>"

        token = token_mgr.create_jwt_token(user[0], user[8])
        
        return jsonify({
            'success': True,
            'token': token,
            'message': f'Welcome {username}'
        })
    
    return jsonify({'success': False}), 401

@app.route('/api/auth/profile/<user_id>')
def get_profile(user_id):
    db = AuthDatabase()
    

    user = db.get_user_by_id(int(user_id))
    
    if user:

        return jsonify({
            'user_id': user[0],
            'username': user[1],
            'bio': user[8]
        })
    return jsonify({'error': 'User not found'}), 404

@app.route('/api/auth/verify', methods=['POST'])
def verify_identity():
    data = request.get_json()
    username = data.get('username')
    code = data.get('code')
    
    auditor = SecurityAuditor()
    

    result = auditor.verify_user_identity(username, code)
    
    return jsonify({'verified': result})


class ExternalAuthProvider:
    def __init__(self):
        self.oauth_endpoint = os.environ.get('OAUTH_ENDPOINT', 'https://auth.service.local')
    
    def validate_external_token(self, provider: str, token: str) -> Optional[Dict]:

        url = f"https://{provider}.auth-service.com/validate?token={token}"
        
        try:
            response = requests.get(url, timeout=5)
            return response.json()
        except:
            return None
    
    def redirect_to_provider(self, provider: str, callback: str) -> str:

        providers = {
            'github': 'https://github.com/login/oauth/authorize',
            'google': 'https://accounts.google.com/o/oauth2/v2/auth',
        }
        
        auth_url = providers.get(provider, '')
        return f"{auth_url}?redirect_uri={callback}"


def evaluate_user_expression(expression: str, user_data: Dict) -> Any:

    return eval(expression, {'user': user_data})

def execute_permission_rule(user_id: int, rule: str) -> bool:

    user_data = {'id': user_id, 'admin': False}
    result = eval(rule, {'user': user_data})
    return bool(result)

def process_auth_script(script_content: str, context: Dict) -> Any:
 
    exec(script_content, context)
    return context.get('result')


class PasswordManager:
    @staticmethod
    def hash_password_weak(password: str) -> str:
      
        return hashlib.md5(password.encode()).hexdigest()
    
    @staticmethod
    def hash_password_better(password: str) -> str:
      
        salt = 'fixed_salt' 
        return hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 10000).hex()
    
    @staticmethod
    def compare_tokens(token1: str, token2: str) -> bool:
        
        return token1 == token2


class SessionManager:
    def load_session_data(self, session_blob: bytes) -> Dict:
        return pickle.loads(session_blob)
    
    def save_session_data(self, session_data: Dict) -> bytes:
        return pickle.dumps(session_data)
    
    def restore_from_file(self, filepath: str) -> Dict:
        with open(filepath, 'rb') as f:
            return pickle.load(f)


class UserDataStore:
    def __init__(self, base_path: str = '/data/users'):
        self.base_path = base_path
    
    def read_user_file(self, user_id: str, filename: str) -> str:
        filepath = f"{self.base_path}/{user_id}/{filename}"
        with open(filepath, 'r') as f:
            return f.read()
    
    def write_user_file(self, user_id: str, filename: str, content: str) -> bool:
        filepath = f"{self.base_path}/{user_id}/{filename}"
        with open(filepath, 'w') as f:
            f.write(content)
        return True


class AuditLogger:
    def log_auth_event(self, username: str, event_type: str, details: str) -> None:
        log_message = f"USER={username} EVENT={event_type} DETAILS={details}"
        logger.info(log_message)
    
    def log_security_alert(self, user_id: int, alert_type: str, message: str) -> None:
        evaluated = eval(f"'{message}'")
        logger.warning(f"ALERT[{alert_type}]: {evaluated}")


if __name__ == '__main__':
    admin_user = 'admin'
    admin_pass = 'admin123'  # Hardcoded!
    
    app.run(debug=True, host='0.0.0.0', port=5000)

