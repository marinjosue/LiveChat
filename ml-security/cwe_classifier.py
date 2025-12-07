import pandas as pd
import numpy as np
import os
import pickle
import warnings
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.ensemble import RandomForestClassifier
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, classification_report
)

warnings.filterwarnings('ignore')

print("\n" + "="*80)
print("CWE CLASSIFIER - MODELO 2")
print("="*80)


# ================================================================================
# FASE 1: SAMPLE - Seleccionar y cargar datos
# ================================================================================

print("\n[FASE 1: SAMPLE]")
print("-" * 80)
print("Objetivo: Cargar dataset vulnerable y seleccionar muestras")

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
dataset_path = os.path.join(project_root, 'data', 'processed', 'cybernative_detector_training.csv')

if not os.path.exists(dataset_path):
    print(f"ERROR: Dataset no encontrado en {dataset_path}")
    exit(1)

df = pd.read_csv(dataset_path)
df_vuln = df[df['vulnerable'] == 1].copy()

print(f"Total registros cargados: {len(df):,}")
print(f"Registros vulnerables: {len(df_vuln):,}")
print(f"Tipos CWE originales: {df_vuln['tipo_vulnerabilidad'].nunique()}")
print("FASE 1 completada")


# ================================================================================
# FASE 2: EXPLORE - Analisis exploratorio
# ================================================================================

print("\n[FASE 2: EXPLORE]")
print("-" * 80)
print("Objetivo: Explorar caracteristicas del dataset vulnerable")

def normalize_cwe(cwe_text):
    """Consolida CWEs similares bajo categorias principales"""
    cwe = str(cwe_text).lower().strip()
    
    if 'deserializ' in cwe:
        return 'Insecure Deserialization'
    if 'sql' in cwe and 'injection' in cwe:
        return 'SQL Injection'
    if 'eval' in cwe or ('code' in cwe and 'injection' in cwe):
        return 'Code Injection'
    if 'buffer' in cwe and 'overflow' in cwe:
        return 'Buffer Overflow'
    if 'cross' in cwe and 'script' in cwe or 'xss' in cwe:
        return 'Cross-Site Scripting (XSS)'
    if 'strcpy' in cwe or ('string' in cwe and 'buffer' in cwe):
        return 'Unsafe String Operations'
    if 'uninitializ' in cwe:
        return 'Uninitialized Variables'
    if 'null' in cwe or 'nullpointer' in cwe:
        return 'Null Pointer / Null Safety'
    if 'format' in cwe and 'string' in cwe:
        return 'Format String Attack'
    if 'memory' in cwe and ('arc' in cwe or 'leak' in cwe or 'manage' in cwe):
        return 'Memory Management Issues'
    if 'input' in cwe and ('validation' in cwe or 'sanitiz' in cwe):
        return 'Improper Input Validation'
    
    return cwe_text

df_vuln['cwe_normalizada'] = df_vuln['tipo_vulnerabilidad'].apply(normalize_cwe)

cwe_dist = df_vuln['cwe_normalizada'].value_counts()
print(f"CWE Categories consolidadas: {len(cwe_dist)}")
print(f"Longitud promedio código: {df_vuln['codigo'].str.len().mean():.0f} caracteres")

print("FASE 2 completada")


# ================================================================================
# FASE 3: MODIFY - Transformar datos para modelado
# ================================================================================

print("\n[FASE 3: MODIFY]")
print("-" * 80)
print("Objetivo: Preparar features consolidadas para el modelo")

df_filtered = df_vuln.copy()

print(f"\nUsando todos los datos disponibles")
print(f"Muestras finales: {len(df_filtered):,}")

print(f"\nFeature Engineering (TF-IDF):")
print(f"  - Max features: 1200")
print(f"  - N-grams: (1, 3) - trigramas")
print(f"  - Vectorizando codigo...")

X = df_filtered['codigo'].values

tfidf_vectorizer = TfidfVectorizer(
    max_features=1200,
    ngram_range=(1, 3),
    min_df=2,
    max_df=0.9,
    lowercase=True,
    stop_words='english',
    sublinear_tf=True
)

X_tfidf = tfidf_vectorizer.fit_transform(X)
print(f"  - Matriz TF-IDF shape: {X_tfidf.shape}")

print(f"\nTarget Encoding:")
cwe_encoder = LabelEncoder()
y = df_filtered['cwe_normalizada'].values
y_encoded = cwe_encoder.fit_transform(y)

# Filtrar clases con menos de 2 muestras para stratify
cwe_counts = np.bincount(y_encoded)
valid_classes = np.where(cwe_counts >= 2)[0]
valid_mask = np.isin(y_encoded, valid_classes)
X_tfidf_filtered = X_tfidf[valid_mask]
y_encoded_filtered = y_encoded[valid_mask]

print(f"  - Clases CWE originales: {len(cwe_encoder.classes_)}")
print(f"  - Clases con >=2 muestras: {len(valid_classes)}")
print(f"  - Muestras finales: {len(y_encoded_filtered)}")

print(f"\nDividiendo en train/test (80/20, stratified)...")
X_train, X_test, y_train, y_test = train_test_split(
    X_tfidf_filtered, y_encoded_filtered,
    test_size=0.2,
    random_state=42,
    stratify=y_encoded_filtered
)

print(f"  - Train: {X_train.shape[0]:,} muestras")
print(f"  - Test: {X_test.shape[0]:,} muestras")

print(f"\nCalculando class weights para balance...")
class_weights = compute_class_weight(
    'balanced',
    classes=np.unique(y_train),
    y=y_train
)
class_weight_dict = {cls: weight for cls, weight in zip(np.unique(y_train), class_weights)}
print(f"  - Pesos calculados: {len(class_weight_dict)} clases")

print("\nFASE 3 completada")


# ================================================================================
# FASE 4: MODEL - Entrenar modelo
# ================================================================================

print("\n[FASE 4: MODEL]")
print("-" * 80)
print("Objetivo: Entrenar RandomForest para clasificacion de CWE")

print("\nConfiguracion del modelo:")
print("  - Algoritmo: RandomForestClassifier")
print("  - N estimators: 250")
print("  - Max depth: 15")
print("  - Min samples split: 3")
print("  - Class weight: balanced")
print("  - Random state: 42")

model = RandomForestClassifier(
    n_estimators=250,
    max_depth=15,
    min_samples_split=3,
    min_samples_leaf=2,
    class_weight=class_weight_dict,
    criterion='gini',
    random_state=42,
    n_jobs=-1,
    verbose=1
)

print("\nEntrenando modelo...")
model.fit(X_train, y_train)
print("Entrenamiento completado")

print("\nFASE 4 completada")


# ================================================================================
# FASE 5: ASSESS - Evaluar modelo
# ================================================================================

print("\n[FASE 5: ASSESS]")
print("-" * 80)
print("Objetivo: Evaluar performance en datos de prueba")

print("\nGenerando predicciones...")
y_pred_train = model.predict(X_train)
y_pred_test = model.predict(X_test)

train_acc = accuracy_score(y_train, y_pred_train)
train_f1 = f1_score(y_train, y_pred_train, average='weighted', zero_division=0)

test_acc = accuracy_score(y_test, y_pred_test)
test_prec = precision_score(y_test, y_pred_test, average='weighted', zero_division=0)
test_rec = recall_score(y_test, y_pred_test, average='weighted', zero_division=0)
test_f1 = f1_score(y_test, y_pred_test, average='weighted', zero_division=0)

print(f"\nMETRICAS EN TRAIN SET:")
print(f"  - Accuracy: {train_acc:.4f} ({train_acc*100:.2f}%)")
print(f"  - F1-Score: {train_f1:.4f} ({train_f1*100:.2f}%)")

print(f"\nMETRICAS EN TEST SET:")
print(f"  - Accuracy:  {test_acc:.4f} ({test_acc*100:.2f}%)")
print(f"  - Precision: {test_prec:.4f} ({test_prec*100:.2f}%)")
print(f"  - Recall:    {test_rec:.4f} ({test_rec*100:.2f}%)")
print(f"  - F1-Score:  {test_f1:.4f} ({test_f1*100:.2f}%)")

print(f"\nVALIDACION CRUZADA (5-Fold StratifiedKFold):")
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
cv_scores = cross_val_score(model, X_tfidf, y_encoded, cv=skf, scoring='f1_weighted')
print(f"  - Fold 1: {cv_scores[0]:.4f}")
print(f"  - Fold 2: {cv_scores[1]:.4f}")
print(f"  - Fold 3: {cv_scores[2]:.4f}")
print(f"  - Fold 4: {cv_scores[3]:.4f}")
print(f"  - Fold 5: {cv_scores[4]:.4f}")
print(f"  - Promedio: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")

overfit_diff = train_acc - test_acc
print(f"\nANALISIS DE OVERFITTING:")
print(f"  - Train Accuracy: {train_acc:.4f}")
print(f"  - Test Accuracy:  {test_acc:.4f}")
print(f"  - Diferencia:     {overfit_diff:.4f} ({overfit_diff*100:.2f}%)")
if overfit_diff < 0.10:
    print(f"  - Estado: ACEPTABLE (bajo overfitting)")
else:
    print(f"  - Estado: MODERADO (overfitting presente)")

print(f"\nREPORTE DE CLASIFICACION (TEST):")
all_labels = np.unique(np.concatenate([y_test, y_pred_test]))
target_names_filtered = cwe_encoder.classes_[all_labels]
print(classification_report(
    y_test, y_pred_test,
    labels=all_labels,
    target_names=target_names_filtered,
    zero_division=0
))

print("\nFASE 5 completada")


# ================================================================================
# GUARDAR ARTEFACTOS
# ================================================================================

print("\n[GUARDANDO ARTEFACTOS]")
print("-" * 80)

os.makedirs(os.path.join(project_root, 'models'), exist_ok=True)

model_path = os.path.join(project_root, 'models', 'cwe_classifier.pkl')
with open(model_path, 'wb') as f:
    pickle.dump(model, f)
print(f"Modelo guardado: {model_path}")

vectorizer_path = os.path.join(project_root, 'models', 'vectorizer_cwe_classifier.pkl')
with open(vectorizer_path, 'wb') as f:
    pickle.dump(tfidf_vectorizer, f)
print(f"Vectorizador guardado: {vectorizer_path}")

encoder_path = os.path.join(project_root, 'models', 'cwe_encoder.pkl')
with open(encoder_path, 'wb') as f:
    pickle.dump(cwe_encoder, f)
print(f"Encoder guardado: {encoder_path}")

metrics_path = os.path.join(project_root, 'models', 'metrics_cwe_classifier.txt')
with open(metrics_path, 'w') as f:
    f.write("CWE CLASSIFIER - METRICAS FINALES\n")
    f.write("="*60 + "\n\n")
    f.write("DATASET:\n")
    f.write(f"  Muestras vulnerables originales: {len(df_vuln):,}\n")
    f.write(f"  Muestras procesadas: {len(df_filtered):,}\n")
    f.write(f"  Train: {X_train.shape[0]:,}\n")
    f.write(f"  Test: {X_test.shape[0]:,}\n\n")
    f.write("PERFORMANCE (TEST SET):\n")
    f.write(f"  Accuracy:  {test_acc:.4f}\n")
    f.write(f"  Precision: {test_prec:.4f}\n")
    f.write(f"  Recall:    {test_rec:.4f}\n")
    f.write(f"  F1-Score:  {test_f1:.4f}\n")
    f.write(f"  K-Fold CV: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})\n\n")
    f.write("CONFIGURACION:\n")
    f.write(f"  Algoritmo: RandomForestClassifier\n")
    f.write(f"  N estimators: 250\n")
    f.write(f"  Max depth: 15\n")
    f.write(f"  Features: 1200 TF-IDF (trigramas)\n\n")
    f.write("CATEGORIAS CWE:\n")
    for idx, cwe_name in enumerate(cwe_encoder.classes_):
        count = (y_encoded == idx).sum()
        f.write(f"  {idx+1}. {cwe_name}: {count}\n")
print(f"Metricas guardadas: {metrics_path}")


# ================================================================================
# RESUMEN FINAL
# ================================================================================

print("\n" + "="*80)
print("RESUMEN DEL ENTRENAMIENTO")
print("="*80)

print(f"\nPERFORMANCE:")
print(f"  - Accuracy:  {test_acc*100:.2f}%")
print(f"  - F1-Score:  {test_f1*100:.2f}%")
print(f"  - K-Fold CV: {cv_scores.mean()*100:.2f}%")
