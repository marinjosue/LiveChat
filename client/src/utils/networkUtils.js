export const getClientIp = async () => {
    try {
        const response = await fetch('https://livechat-9oej.onrender.com/get-ip');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error('Error obteniendo la IP:', error);
        return null;
    }
};
