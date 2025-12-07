samples = [
    {
        "nombre": "Python - User Management API",
        "codigo": """from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

@app.route('/user', methods=['GET'])
def get_user():
    user_id = request.args.get('id')
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    query = f"SELECT * FROM users WHERE id = {user_id}"
    cursor.execute(query)
    result = cursor.fetchone()
    conn.close()
    return jsonify({'user': result})

@app.route('/search', methods=['POST'])
def search():
    username = request.form.get('username')
    password = request.form.get('password')
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    sql = "SELECT * FROM accounts WHERE username='" + username + "' AND password='" + password + "'"
    cursor.execute(sql)
    user = cursor.fetchone()
    conn.close()
    return jsonify({'authenticated': user is not None})
""",
        "lenguaje": "python",
        "tipo_esperado": "SQL Injection"
    },
    {
        "nombre": "Python - File Processing Service",
        "codigo": """import os
from flask import Flask, request

app = Flask(__name__)

@app.route('/process', methods=['GET'])
def process_file():
    filename = request.args.get('file')
    filepath = os.path.join('/data/uploads/', filename)
    
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        system_cmd = f'cat {filepath} | grep "error"'
        os.system(system_cmd)
        
        return {'content': content}
    except Exception as e:
        return {'error': str(e)}
""",
        "lenguaje": "python",
        "tipo_esperado": "Path Traversal"
    },
    {
        "nombre": "Python - Data Processing",
        "codigo": """import pickle
import logging
from flask import Flask, request

app = Flask(__name__)

@app.route('/upload', methods=['POST'])
def upload_data():
    try:
        serialized_data = request.data
        obj = pickle.loads(serialized_data)
        
        logging.info(f"Loaded object: {type(obj)}")
        
        processed = process_object(obj)
        return {'result': str(processed)}
    except Exception as e:
        logging.error(f"Error: {e}")
        return {'error': str(e)}, 500

def process_object(obj):
    return len(str(obj))
""",
        "lenguaje": "python",
        "tipo_esperado": "Deserialization"
    },
    {
        "nombre": "Python - Expression Evaluator",
        "codigo": """from flask import Flask, request

app = Flask(__name__)

@app.route('/calc', methods=['GET'])
def calculator():
    expression = request.args.get('expr', '0')
    
    try:
        result = eval(expression)
        return {'result': result}
    except SyntaxError:
        return {'error': 'Invalid expression'}, 400
    except Exception as e:
        return {'error': str(e)}, 500
""",
        "lenguaje": "python",
        "tipo_esperado": "Code Injection"
    },
    {
        "nombre": "Python - Authentication System",
        "codigo": """import hashlib
from flask import Flask, request

app = Flask(__name__)

@app.route('/register', methods=['POST'])
def register():
    username = request.form.get('username')
    password = request.form.get('password')
    
    hash_obj = hashlib.md5(password.encode())
    password_hash = hash_obj.hexdigest()
    
    with open('users.txt', 'a') as f:
        f.write(f"{username}:{password_hash}\\n")
    
    return {'status': 'registered'}
""",
        "lenguaje": "python",
        "tipo_esperado": "Weak Cryptography"
    },
    {
        "nombre": "Python - Profile Page",
        "codigo": """from flask import Flask, render_template_string, request

app = Flask(__name__)

@app.route('/profile', methods=['GET'])
def profile():
    name = request.args.get('name', 'Guest')
    bio = request.args.get('bio', '')
    
    template = f'''
    <html>
    <body>
        <h1>Profile: {name}</h1>
        <p>Bio: {bio}</p>
    </body>
    </html>
    '''
    
    return render_template_string(template)
""",
        "lenguaje": "python",
        "tipo_esperado": "Cross-site Scripting"
    },
    {
        "nombre": "Python - Safe Database Query",
        "codigo": """import sqlite3
from flask import Flask, request

app = Flask(__name__)

@app.route('/user', methods=['GET'])
def get_user():
    user_id = request.args.get('id')
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    result = cursor.fetchone()
    conn.close()
    
    return {'user': result}
""",
        "lenguaje": "python",
        "tipo_esperado": None
    },
    {
        "nombre": "Python - Safe Hash Implementation",
        "codigo": """import hashlib
import secrets

def hash_password(password):
    salt = secrets.token_hex(32)
    hash_obj = hashlib.sha256((password + salt).encode())
    password_hash = hash_obj.hexdigest()
    return f"{salt}${password_hash}"

def verify_password(password, stored_hash):
    salt, hash_value = stored_hash.split('$')
    computed = hashlib.sha256((password + salt).encode()).hexdigest()
    return computed == hash_value
""",
        "lenguaje": "python",
        "tipo_esperado": None
    },
    {
        "nombre": "JavaScript - Web Server",
        "codigo": """const express = require('express');
const fs = require('fs');
const app = express();

app.get('/api/user', (req, res) => {
    const userId = req.query.id;
    const query = `SELECT * FROM users WHERE id = ${userId}`;
    
    db.query(query, (err, result) => {
        if (err) {
            res.status(500).json({error: err});
        } else {
            res.json({user: result});
        }
    });
});

app.get('/file', (req, res) => {
    const filename = req.query.file;
    const content = fs.readFileSync(filename, 'utf8');
    res.send(content);
});

app.listen(3000);
""",
        "lenguaje": "javascript",
        "tipo_esperado": "SQL Injection"
    },
    {
        "nombre": "JavaScript - DOM Manipulation",
        "codigo": """document.getElementById('search-btn').addEventListener('click', function() {
    const userInput = document.getElementById('input').value;
    const output = document.getElementById('output');
    
    output.innerHTML = '<p>Results for: ' + userInput + '</p>';
    
    fetch('/api/search?q=' + userInput)
        .then(res => res.json())
        .then(data => {
            output.innerHTML += '<div>' + data.result + '</div>';
        });
});
""",
        "lenguaje": "javascript",
        "tipo_esperado": "Cross-site Scripting"
    },
    {
        "nombre": "JavaScript - Weak Crypto",
        "codigo": """const crypto = require('crypto');

function generateToken(password) {
    const hash = crypto.createHash('md5');
    hash.update(password);
    return hash.digest('hex');
}

function storePassword(username, password) {
    const token = generateToken(password);
    db.users.insert({
        username: username,
        token: token
    });
}
""",
        "lenguaje": "javascript",
        "tipo_esperado": "Weak Cryptography"
    },
    {
        "nombre": "Java - Spring Boot API",
        "codigo": """import org.springframework.web.bind.annotation.*;
import javax.servlet.http.HttpServletRequest;

@RestController
public class UserController {
    
    @GetMapping("/user")
    public User getUser(@RequestParam String id) {
        String query = "SELECT * FROM users WHERE id = " + id;
        Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery(query);
        return mapToUser(rs);
    }
    
    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest req) {
        String username = req.getUsername();
        String password = req.getPassword();
        
        Runtime rt = Runtime.getRuntime();
        Process p = rt.exec("sh -c " + "grep " + username + " /etc/passwd");
        
        return new LoginResponse(true);
    }
}
""",
        "lenguaje": "java",
        "tipo_esperado": "SQL Injection"
    },
    {
        "nombre": "Java - File Handler",
        "codigo": """import java.io.*;

public class FileService {
    
    public String readFile(String filename) throws IOException {
        File f = new File("/data/files/" + filename);
        
        if (!f.exists()) {
            throw new FileNotFoundException(filename);
        }
        
        StringBuilder content = new StringBuilder();
        try (BufferedReader br = new BufferedReader(new FileReader(f))) {
            String line;
            while ((line = br.readLine()) != null) {
                content.append(line);
            }
        }
        
        return content.toString();
    }
}
""",
        "lenguaje": "java",
        "tipo_esperado": "Path Traversal"
    },
    {
        "nombre": "Java - Weak Hash",
        "codigo": """import java.security.MessageDigest;

public class AuthService {
    
    public String hashPassword(String password) throws Exception {
        MessageDigest md = MessageDigest.getInstance("MD5");
        byte[] messageDigest = md.digest(password.getBytes());
        
        StringBuilder sb = new StringBuilder();
        for (byte b : messageDigest) {
            sb.append(String.format("%02x", b));
        }
        
        return sb.toString();
    }
    
    public boolean authenticate(String user, String pwd) {
        String hash = hashPassword(pwd);
        return db.verifyCredentials(user, hash);
    }
}
""",
        "lenguaje": "java",
        "tipo_esperado": "Weak Cryptography"
    },
    {
        "nombre": "Java - Safe Query",
        "codigo": """import java.sql.PreparedStatement;

public class UserRepository {
    
    public User findById(String id) throws SQLException {
        String query = "SELECT * FROM users WHERE id = ?";
        PreparedStatement pstmt = conn.prepareStatement(query);
        pstmt.setString(1, id);
        
        ResultSet rs = pstmt.executeQuery();
        if (rs.next()) {
            return mapToUser(rs);
        }
        return null;
    }
}
""",
        "lenguaje": "java",
        "tipo_esperado": None
    },
    {
        "nombre": "C++ - Legacy Application",
        "codigo": """#include <cstring>
#include <cstdio>

void processUserInput(const char* input) {
    char buffer[32];
    
    strcpy(buffer, input);
    
    printf("Processing: %s\\n", buffer);
}

int main() {
    char userInput[256];
    
    fgets(userInput, sizeof(userInput), stdin);
    processUserInput(userInput);
    
    return 0;
}
""",
        "lenguaje": "c++",
        "tipo_esperado": "Buffer Overflow"
    },
    {
        "nombre": "C++ - Memory Management",
        "codigo": """#include <iostream>

class DataBuffer {
private:
    int* data;
    int size;
    
public:
    DataBuffer(int s) : size(s) {
        data = new int[size];
    }
    
    void setValue(int index, int value) {
        data[index] = value;
    }
    
    ~DataBuffer() {
        delete[] data;
        delete[] data;
    }
};

int main() {
    DataBuffer buf(10);
    buf.setValue(15, 42);
    return 0;
}
""",
        "lenguaje": "c++",
        "tipo_esperado": "Buffer Overflow"
    },
    {
        "nombre": "PHP - Form Handler",
        "codigo": """<?php
$id = $_GET['id'];
$username = $_POST['username'];

$query = "SELECT * FROM users WHERE id = '" . $id . "'";
$result = mysqli_query($conn, $query);

while ($row = mysqli_fetch_assoc($result)) {
    echo "<h1>" . $username . "</h1>";
    echo "<p>" . $row['bio'] . "</p>";
}

$cmd = "cat /var/log/" . $_GET['logfile'];
exec($cmd, $output);
?>
""",
        "lenguaje": "php",
        "tipo_esperado": "SQL Injection"
    },
    {
        "nombre": "PHP - Safe Query",
        "codigo": """<?php
$id = $_GET['id'];

$query = "SELECT * FROM users WHERE id = ?";
$stmt = $conn->prepare($query);
$stmt->bind_param("i", $id);
$stmt->execute();

$result = $stmt->get_result();
while ($row = $result->fetch_assoc()) {
    echo htmlspecialchars($row['name'], ENT_QUOTES, 'UTF-8');
}
$stmt->close();
?>
""",
        "lenguaje": "php",
        "tipo_esperado": None
    },
    {
        "nombre": "Ruby - Rails Controller",
        "codigo": """class UserController < ApplicationController
    def search
        username = params[:username]
        password = params[:password]
        
        query = "SELECT * FROM users WHERE username='#{username}' AND password='#{password}'"
        @user = User.find_by_sql(query)
        
        filename = params[:file]
        output = `cat /data/#{filename}`
        
        render json: {success: true}
    end
end
""",
        "lenguaje": "ruby",
        "tipo_esperado": "SQL Injection"
    },
    {
        "nombre": "Ruby - Safe Query",
        "codigo": """class UserController < ApplicationController
    def search
        username = params[:username]
        password = params[:password]
        
        @user = User.where(username: username, password: password).first
        
        render json: {success: @user.present?}
    end
end
""",
        "lenguaje": "ruby",
        "tipo_esperado": None
    },
    {
        "nombre": "Go - HTTP Server",
        "codigo": """package main

import (
    "fmt"
    "net/http"
    "os/exec"
)

func queryUser(w http.ResponseWriter, r *http.Request) {
    userId := r.URL.Query().Get("id")
    query := fmt.Sprintf("SELECT * FROM users WHERE id = %s", userId)
    
    rows, err := db.Query(query)
    if err != nil {
        http.Error(w, err.Error(), 500)
    }
    defer rows.Close()
}

func executeCommand(w http.ResponseWriter, r *http.Request) {
    cmd := r.URL.Query().Get("command")
    output, err := exec.Command("sh", "-c", cmd).Output()
    fmt.Fprintf(w, "%s", string(output))
}

func main() {
    http.HandleFunc("/user", queryUser)
    http.HandleFunc("/exec", executeCommand)
    http.ListenAndServe(":8080", nil)
}
""",
        "lenguaje": "go",
        "tipo_esperado": "SQL Injection"
    },
    {
        "nombre": "Go - Safe Query",
        "codigo": """package main

import (
    "database/sql"
    "fmt"
)

func queryUser(w http.ResponseWriter, r *http.Request) {
    userId := r.URL.Query().Get("id")
    
    var name string
    row := db.QueryRow("SELECT name FROM users WHERE id = ?", userId)
    err := row.Scan(&name)
    
    if err != nil {
        http.Error(w, "Not found", 404)
    }
    
    fmt.Fprintf(w, "User: %s", name)
}
""",
        "lenguaje": "go",
        "tipo_esperado": None
    },
    {
        "nombre": "C# - ASP.NET Controller",
        "codigo": """using System;
using System.Data.SqlClient;
using System.Web.Mvc;

public class UserController : Controller {
    
    public ActionResult GetUser(string id) {
        string query = "SELECT * FROM users WHERE id = " + id;
        
        using (SqlConnection conn = new SqlConnection(connString)) {
            SqlCommand cmd = new SqlCommand(query, conn);
            conn.Open();
            SqlDataReader reader = cmd.ExecuteReader();
            
            return View(reader);
        }
    }
    
    [HttpPost]
    public ActionResult Execute(string className) {
        Type type = Type.GetType(className);
        var instance = Activator.CreateInstance(type);
        return Json(new {status = "executed"});
    }
}
""",
        "lenguaje": "c#",
        "tipo_esperado": "SQL Injection"
    },
    {
        "nombre": "C# - Safe Query",
        "codigo": """using System;
using System.Data.SqlClient;

public class UserRepository {
    
    public User GetUserById(string id) {
        string query = "SELECT * FROM users WHERE id = @id";
        
        using (SqlConnection conn = new SqlConnection(connString)) {
            SqlCommand cmd = new SqlCommand(query, conn);
            cmd.Parameters.AddWithValue("@id", id);
            
            conn.Open();
            SqlDataReader reader = cmd.ExecuteReader();
            
            if (reader.Read()) {
                return MapToUser(reader);
            }
        }
        return null;
    }
}
""",
        "lenguaje": "c#",
        "tipo_esperado": None
    },
    {
        "nombre": "Swift - iOS App",
        "codigo": """import Foundation

class UserService {
    func getUserData(userId: String) -> [String: Any]? {
        let query = "SELECT * FROM users WHERE id = \\(userId)"
        let result = database.executeQuery(query)
        return result?.first
    }
    
    func processFile(filename: String) -> String? {
        let path = "/Documents/\\(filename)"
        do {
            let content = try String(contentsOfFile: path)
            return content
        } catch {
            return nil
        }
    }
}
""",
        "lenguaje": "swift",
        "tipo_esperado": "SQL Injection"
    },
    {
        "nombre": "Kotlin - Android App",
        "codigo": """class UserRepository(private val db: SQLiteDatabase) {
    
    fun getUserById(id: String): User? {
        val query = "SELECT * FROM users WHERE id = $id"
        val cursor = db.rawQuery(query, null)
        
        if (cursor.moveToFirst()) {
            val user = User(
                id = cursor.getInt(0),
                name = cursor.getString(1)
            )
            cursor.close()
            return user
        }
        return null
    }
}
""",
        "lenguaje": "kotlin",
        "tipo_esperado": "SQL Injection"
    },
    {
        "nombre": "Fortran - Data Processing",
        "codigo": """PROGRAM DataProcessor
    CHARACTER(LEN=32) :: buffer
    CHARACTER(LEN=256) :: input_line
    INTEGER :: i
    
    PRINT *, "Enter data:"
    READ(*, '(A)') input_line
    
    buffer = input_line
    
    PRINT *, "Processing: ", TRIM(buffer)
    
END PROGRAM DataProcessor
""",
        "lenguaje": "fortran",
        "tipo_esperado": "Buffer Overflow"
    },
    {
        "nombre": "Python - Safe Prepared Statement",
        "codigo": """def calculate_average(numbers):
    total = sum(numbers)
    count = len(numbers)
    average = total / count
    return average

def format_output(value):
    return f"Result: {value:.2f}"

result = calculate_average([10, 20, 30, 40])
print(format_output(result))
""",
        "lenguaje": "python",
        "tipo_esperado": None
    },
    {
        "nombre": "Python - HTML Escaping",
        "codigo": """def validate_email(email):
    if '@' in email and '.' in email:
        return True
    return False

def validate_phone(phone):
    digits = ''.join(c for c in phone if c.isdigit())
    return len(digits) == 10

email = "user@example.com"
phone = "555-123-4567"

if validate_email(email) and validate_phone(phone):
    print("Valid contact information")
""",
        "lenguaje": "python",
        "tipo_esperado": None
    },
]

all_samples = samples

