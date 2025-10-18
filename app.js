// Configuration and State Management
const config = {
    apiEndpoint: '/.netlify/functions/chat',
    auth0: {
        domain: process.env.AUTH0_DOMAIN,
        clientId: process.env.AUTH0_CLIENT_ID,
        audience: process.env.AUTH0_AUDIENCE
    }
};

let chatState = {
    isAuthenticated: false,
    user: null,
    messages: [],
    accessToken: null
};

// Auth0 Configuration and Management
let auth0Client = null;

async function initializeAuth0() {
    try {
        auth0Client = await auth0.createAuth0Client({
            domain: config.auth0.domain,
            clientId: config.auth0.clientId,
            authorizationParams: {
                audience: config.auth0.audience
            }
        });

        // Handle callback
        if (window.location.search.includes("code=")) {
            await auth0Client.handleRedirectCallback();
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Check authentication state
        chatState.isAuthenticated = await auth0Client.isAuthenticated();
        if (chatState.isAuthenticated) {
            chatState.user = await auth0Client.getUser();
            chatState.accessToken = await auth0Client.getTokenSilently();
            showChatInterface();
        } else {
            showLoginInterface();
        }
    } catch (error) {
        console.error('Error initializing Auth0:', error);
        showError('Authentication system initialization failed');
    }
}

// UI Management
function showChatInterface() {
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('chat-container').classList.remove('hidden');
    document.getElementById('user-email').textContent = chatState.user.email;
    enableChatInput();
    addSystemMessage('Welcome! How can I help you today?');
}

function showLoginInterface() {
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('chat-container').classList.add('hidden');
}

function enableChatInput() {
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
}

// Message Handling
function addMessage(content, type = 'user') {
    const chatBox = document.getElementById('chat-box');
    const messageDiv = document.createElement('div');
    const bubble = document.createElement('div');
    
    messageDiv.className = `mb-4 flex ${type === 'user' ? 'justify-end' : 'justify-start'}`;
    bubble.className = `max-w-xs md:max-w-md p-3 rounded-xl ${
        type === 'user' ? 'chat-bubble-user' : 'chat-bubble-bot'
    }`;

    // Handle markdown-style formatting if it's a bot message
    if (type === 'bot') {
        bubble.innerHTML = formatMessage(content);
    } else {
        bubble.textContent = content;
    }

    messageDiv.appendChild(bubble);
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    // Store message in state
    chatState.messages.push({
        content,
        type,
        timestamp: new Date().toISOString()
    });
}

function addSystemMessage(content) {
    addMessage(content, 'bot');
}

function formatMessage(content) {
    // Basic markdown-style formatting
    return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

// API Communication
async function sendMessageToAPI(message) {
    try {
        const response = await fetch(config.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${chatState.accessToken}`
            },
            body: JSON.stringify({
                message,
                userId: chatState.user.sub,
                timestamp: new Date().toISOString()
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
}

// Event Handlers
async function handleUserInput() {
    const userInput = document.getElementById('user-input');
    const message = userInput.value.trim();
    
    if (!message) return;
    
    // Clear input and disable until response is received
    userInput.value = '';
    userInput.disabled = true;
    document.getElementById('send-btn').disabled = true;

    // Add user message to chat
    addMessage(message, 'user');

    try {
        // Show typing indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-dots mb-4 flex justify-start';
        loadingDiv.innerHTML = '<div class="chat-bubble-bot p-3 rounded-xl">Typing</div>';
        document.getElementById('chat-box').appendChild(loadingDiv);

        // Get response from API
        const response = await sendMessageToAPI(message);
        
        // Remove typing indicator
        loadingDiv.remove();
        
        // Add bot response
        addMessage(response, 'bot');
    } catch (error) {
        addSystemMessage('Sorry, I encountered an error processing your message. Please try again.');
    } finally {
        // Re-enable input
        userInput.disabled = false;
        document.getElementById('send-btn').disabled = false;
        userInput.focus();
    }
}

// Error Handling
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative';
    errorDiv.role = 'alert';
    errorDiv.textContent = message;
    document.body.prepend(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth0();

    // Login button
    document.getElementById('login-btn').addEventListener('click', () => {
        auth0Client.loginWithRedirect();
    });

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', () => {
        auth0Client.logout({
            returnTo: window.location.origin
        });
    });

    // Send message button
    document.getElementById('send-btn').addEventListener('click', handleUserInput);

    // Enter key in input
    document.getElementById('user-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleUserInput();
        }
    });
});

// Export for potential use in other modules
export {
    chatState,
    addMessage,
    addSystemMessage,
    showError
};
