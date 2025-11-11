export const getClientIp = async () => {
    try {
        const response = await fetch('http://localhost:3001/get-ip');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error('Error obteniendo la IP:', error);
        return null;
    }
};
