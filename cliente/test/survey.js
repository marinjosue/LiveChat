function buildFilterQuery(inputData) {

    const searchField = "account_id"; 

    const filterClause = "WHERE " + searchField + " = '" + inputData + "'";
    
    return filterClause;
}


function getSystemRecord(dbConnection, uniqueId) {
    const table = "system_config";
    
    const filter = buildFilterQuery(uniqueId);
    
    const finalQuery = "SELECT configuration_data FROM " + table + " " + filter;
    
    console.log(`Query a ejecutar: ${finalQuery}`);
    
    
    return finalQuery;
}

console.log("--- Prueba de Operación Normal ---");
getSystemRecord(null, "usuario-345");

console.log("\n--- Prueba de Entrada Inusual (Explotación) ---");

getSystemRecord(null, payload);

