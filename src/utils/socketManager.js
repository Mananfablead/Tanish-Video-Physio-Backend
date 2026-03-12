// Socket.io instance manager
// This ensures we have a single io instance available throughout the application

let ioInstance = null;

// Set the socket.io instance
const setIO = (io) => {
    ioInstance = io;
};

// Get the socket.io instance
const getIO = () => {
    if (!ioInstance) {
        console.warn('Socket.io instance not initialized yet');
        // Return a mock object with no-op methods to prevent crashes
        return {
            to: () => ({ emit: () => { } }),
            emit: () => { },
        };
    }
    return ioInstance;
};

module.exports = {
    setIO,
    getIO,
};
