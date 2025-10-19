// app.js

let auth0Client = null;

// Function to fetch Auth0 configuration from the serverless function
const fetchAuthConfig = () => {
    return {
        domain: process.env.AUTH0_DOMAIN,
        clientId: process.env.AUTH0_CLIENT_ID,
        authorizationParams: {
            audience: process.env.AUTH0_AUDIENCE,
        }
    };
};

// Function to initialize Auth0 client
const configureClient = async () => {
    try {
        const config = fetchAuthConfig();
        auth0Client = await auth0.createAuth0Client({
            domain: config.domain,
            clientId: config.clientId,
            authorizationParams: {
                redirect_uri: window.location.origin,
                audience: config.authorizationParams.audience,
            },
        });
    } catch (error) {
        console.error('Error configuring Auth0 client:', error);
    }
};

// Main function to handle authentication and UI updates
const main = async () => {
    await configureClient();
    updateUI();

    const isAuthenticated = await auth0Client.isAuthenticated();

    if (isAuthenticated) {
        return;
    }

    const query = window.location.search;
    if (query.includes('code=') && query.includes('state=')) {
        await auth0Client.handleRedirectCallback();
        updateUI();
        window.history.replaceState({}, document.title, '/');
    }
};

// Function to update the UI based on authentication state
const updateUI = async () => {
    const isAuthenticated = await auth0Client.isAuthenticated();
    document.getElementById('login-view').classList.toggle('hidden', isAuthenticated);
    document.getElementById('chat-view').classList.toggle('hidden', !isAuthenticated);
};

// Event listeners for login and logout
document.getElementById('login-button').addEventListener('click', async () => {
    await auth0Client.loginWithRedirect();
});

document.getElementById('logout-button').addEventListener('click', () => {
    auth0Client.logout({
        logoutParams: {
            returnTo: window.location.origin
        }
    });
});

// Event listener for sending messages
document.getElementById('send-button').addEventListener('click', async () => {
    const userInput = document.getElementById('user-input');
    const message = userInput.value.trim();
    if (message) {
        addMessage('user', message);
        userInput.value = '';

        try {
            const accessToken = await auth0Client.getTokenSilently();
            const response = await fetch('/.netlify/functions/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ message })
            });

            if (response.ok) {
                const data = await response.json();
                addMessage('bot', data.reply);
            } else {
                addMessage('bot', 'Sorry, there was an error.');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            addMessage('bot', 'Sorry, there was an error.');
        }
    }
});

// Function to add a message to the chatbox
const addMessage = (sender, text) => {
    const chatBox = document.getElementById('chat-box');
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);
    messageElement.textContent = text;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
};

// Initialize the application
main();
