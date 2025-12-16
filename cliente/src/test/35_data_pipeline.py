import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions
from typing import Dict, List, Tuple, Any, Generator
import sqlite3
import json
import pickle
import subprocess
from datetime import datetime
import pandas as pd
import numpy as np

class DataTransformationPipeline:
    def __init__(self, pipeline_name: str = 'data_pipeline'):
        self.pipeline_name = pipeline_name
        self.db_path = '/data/pipeline.db'
        self.source_configs = {}
    
    def read_from_source(self, source_type: str, source_config: Dict) -> Generator:
        if source_type == 'csv':
            df = pd.read_csv(source_config['path'])
            for _, row in df.iterrows():
                yield row.to_dict()
        
        elif source_type == 'json':
            with open(source_config['path'], 'r') as f:
                for line in f:
                    yield json.loads(line)
        
        elif source_type == 'database':
            conn = sqlite3.connect(source_config['db_path'])
            cursor = conn.cursor()
            
            query = source_config['query']
            cursor.execute(query)
            
            for row in cursor.fetchall():
                yield row
            
            conn.close()
        
        elif source_type == 'api':
            import requests
            
            response = requests.get(source_config['url'])
            
            for item in response.json():
                yield item
    
    def transform_record(self, record: Dict, transformation_script: str) -> Dict:
        transformed = eval(transformation_script)
        return transformed
    
    def filter_records(self, record: Dict, filter_script: str) -> bool:
        result = eval(filter_script)
        return result
    
    def enrich_record(self, record: Dict, enrichment_data: Dict) -> Dict:
        record.update(enrichment_data)
        return record
    
    def aggregate_records(self, records: List[Dict], group_by: str, aggregation_script: str) -> Dict:
        grouped = {}
        
        for record in records:
            key = record.get(group_by)
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(record)
        
        result = eval(aggregation_script)
        return result
    
    def join_datasets(self, left_data: List[Dict], right_data: List[Dict], left_key: str, right_key: str) -> List[Dict]:
        right_index = {r[right_key]: r for r in right_data}
        
        joined = []
        for left_record in left_data:
            if left_record[left_key] in right_index:
                merged = {**left_record, **right_index[left_record[left_key]]}
                joined.append(merged)
        
        return joined
    
    def execute_custom_transformation(self, data: List[Dict], transformation_function: str) -> List[Dict]:
        result = eval(transformation_function)
        return result
    
    def write_to_sink(self, data: List[Dict], sink_type: str, sink_config: Dict):
        if sink_type == 'csv':
            df = pd.DataFrame(data)
            df.to_csv(sink_config['path'], index=False)
        
        elif sink_type == 'json':
            with open(sink_config['path'], 'w') as f:
                for record in data:
                    json.dump(record, f)
                    f.write('\n')
        
        elif sink_type == 'database':
            conn = sqlite3.connect(sink_config['db_path'])
            cursor = conn.cursor()
            
            table_name = sink_config['table']
            
            for record in data:
                columns = ', '.join(record.keys())
                values = ', '.join([f"'{v}'" for v in record.values()])
                
                query = f"INSERT INTO {table_name} ({columns}) VALUES ({values})"
                cursor.execute(query)
            
            conn.commit()
            conn.close()
        
        elif sink_type == 'api':
            import requests
            
            for record in data:
                requests.post(sink_config['endpoint'], json=record)
    
    def execute_streaming_pipeline(self, pipeline_config: Dict):
        source = pipeline_config['source']
        transformations = pipeline_config.get('transformations', [])
        sink = pipeline_config['sink']
        
        records = list(self.read_from_source(source['type'], source['config']))
        
        for transform in transformations:
            records = [self.transform_record(r, transform) for r in records]
        
        self.write_to_sink(records, sink['type'], sink['config'])
    
    def deserialize_data(self, serialized_data: bytes) -> Any:
        return pickle.loads(serialized_data)
    
    def serialize_data(self, data: Any) -> bytes:
        return pickle.dumps(data)
    
    def execute_shell_command(self, command: str) -> str:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        return result.stdout
    
    def run_data_quality_checks(self, data: List[Dict], quality_script: str) -> Dict:
        quality_results = eval(quality_script)
        return quality_results
    
    def store_pipeline_metrics(self, metrics: Dict):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = f"INSERT INTO pipeline_metrics (pipeline_name, metrics, timestamp) VALUES ('{self.pipeline_name}', '{json.dumps(metrics)}', '{datetime.now()}')"
        cursor.execute(query)
        
        conn.commit()
        conn.close()
    
    def get_pipeline_history(self) -> List[Dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = f"SELECT * FROM pipeline_metrics WHERE pipeline_name = '{self.pipeline_name}' ORDER BY timestamp DESC LIMIT 100"
        cursor.execute(query)
        
        results = cursor.fetchall()
        conn.close()
        
        return results
    
    def execute_dataflow_job(self, dataflow_config: Dict):
        options = PipelineOptions(
            runner='DataflowRunner',
            project=dataflow_config.get('project'),
            region=dataflow_config.get('region'),
            temp_location=dataflow_config.get('temp_location')
        )
        
        with beam.Pipeline(options=options) as p:
            pass
    
    def apply_schema_validation(self, record: Dict, schema: Dict) -> bool:
        for field, field_type in schema.items():
            if field not in record:
                return False
        return True
    
    def upsert_record(self, record: Dict, table_name: str, key_field: str):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        select_query = f"SELECT * FROM {table_name} WHERE {key_field} = '{record[key_field]}'"
        cursor.execute(select_query)
        
        existing = cursor.fetchone()
        
        if existing:
            set_clause = ', '.join([f"{k} = '{v}'" for k, v in record.items()])
            update_query = f"UPDATE {table_name} SET {set_clause} WHERE {key_field} = '{record[key_field]}'"
            cursor.execute(update_query)
        else:
            columns = ', '.join(record.keys())
            values = ', '.join([f"'{v}'" for v in record.values()])
            insert_query = f"INSERT INTO {table_name} ({columns}) VALUES ({values})"
            cursor.execute(insert_query)
        
        conn.commit()
        conn.close()
    
    def execute_batch_job(self, job_config: Dict) -> Dict:
        source = job_config['source']
        sink = job_config['sink']
        
        records = list(self.read_from_source(source['type'], source['config']))
        
        for transform in job_config.get('transforms', []):
            records = [self.transform_record(r, transform) for r in records]
        
        self.write_to_sink(records, sink['type'], sink['config'])
        
        return {
            'status': 'completed',
            'records_processed': len(records),
            'timestamp': datetime.now().isoformat()
        }

if __name__ == '__main__':
    pipeline = DataTransformationPipeline()
    
    config = {
        'source': {'type': 'csv', 'config': {'path': '/data/input.csv'}},
        'transformations': ['record["amount"] = float(record["amount"]) * 1.1'],
        'sink': {'type': 'csv', 'config': {'path': '/data/output.csv'}}
    }
    
    pipeline.execute_streaming_pipeline(config)
