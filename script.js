const typingForm = document.querySelector(".typing-form");
const chatContainer = document.querySelector(".chat-list");
const suggestions = document.querySelectorAll(".suggestion");
const toggleThemeButton = document.querySelector("#theme-toggle-button");
const deleteChatButton = document.querySelector("#delete-chat-button");
const voiceInputButton = document.querySelector("#voice-input-button");
const pauseOutputButton = document.querySelector("#pause-output-button");

let userMessage = null;
let isResponseGenerating = false;
let isTypingPaused = false;
let currentTypingInterval = null;
let typingData = null;

// Chat history storage(array me save ho rahi hai)
let chatHistory = [];
const HISTORY_STORAGE_KEY = 'chatbot_history';

// Load chat history from localStorage
const loadChatHistory = () => {
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (savedHistory) {
        chatHistory = JSON.parse(savedHistory);
        // Render saved messages
        renderSavedChatHistory();
    }
};

// Save chat history (browser ke local storage me save karega)
const saveChatHistory = () => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(chatHistory));
};

// Add a message to chat history
const addMessageToHistory = (role, content) => {
    chatHistory.push({ //it pushes the data into array
        role: role, // 'user' or 'assistant'(message kisne bheja hai)
        content: content, //message kya hai
        timestamp: new Date().toISOString()
    });
    saveChatHistory();
};

// Render saved chat history from memory
const renderSavedChatHistory = () => {
    chatContainer.innerHTML = '';
    
    chatHistory.forEach(message => {
        const isUser = message.role === 'user';
        const html = `<div class="message-content">
                        <img class="avatar" src="images/user1.svg" alt="${isUser ? 'User' : 'Assistant'} avatar">
                        <p class="text"></p>
                      </div>
                      ${!isUser ? `<span onClick="copyMessage(this)" class="icon material-symbols-rounded">content_copy</span>` : ''}`;
        
        const messageDiv = createMessageElement(html, isUser ? "outgoing" : "incoming");
        messageDiv.querySelector(".text").innerText = message.content;
        
        chatContainer.appendChild(messageDiv);
    });
    
    // Hide header if there are messages
    if (chatHistory.length > 0) {
        document.body.classList.add("hide-header");
    }
    
    chatContainer.scrollTo(0, chatContainer.scrollHeight);
};

// Check for speech synthesis support
document.addEventListener("DOMContentLoaded", () => {
    // Load chat history when the page loads
    loadChatHistory();
    
    if (!window.speechSynthesis) {
        console.warn("Text-to-speech is not supported in this browser");
    } else {
        // Pre-load voices
        window.speechSynthesis.getVoices();  //Prepares the browser for speech output 
        
        // Some browsers need a timeout to properly load voices
        setTimeout(() => {
            const voices = window.speechSynthesis.getVoices();
            console.log(`${voices.length} speech synthesis voices available`);
        }, 100);
    }
});

// Text-to-Speech Function
const speakResponse = (text) => {
    // Check if speech synthesis is available
    if (!window.speechSynthesis) {  //browser me speech spport nahi karta check for eg brave
        console.error("Speech synthesis is not supported in this browser");
        return;
    }
    
    try {
        // Create a new utterance
        const utterance = new SpeechSynthesisUtterance(text);
        
        // properties voice ka speed pitch vagera
        utterance.rate = 1.0; // Speed of speech (0.1 to 10)
        utterance.pitch = 1.0; // Pitch (0 to 2)
        utterance.volume = 1.0; // Volume (0 to 1)
        
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        // Speak the text
        window.speechSynthesis.speak(utterance);
        
        // Add event handlers for monitoring speech
        utterance.onstart = () => console.log("Speech started");
        utterance.onend = () => console.log("Speech ended");
        utterance.onerror = (event) => console.error("Speech error:", event.error);
    } catch (error) {
        console.error("Error in text-to-speech:", error);
    }
};

// Stop any ongoing speech
const stopSpeech = () => {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        console.log("Speech synthesis stopped");
    }
};

// Speech Recognition Setup  (This line handles browser compatibility.
//Some browsers only support webkitSpeechRecognition (like Chrome).)

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isListening = false;

// Check if speech recognition is supported
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.lang = 'en-US'; // Set language - can be made configurable

    // Event listener for speech recognition results
    //Converts the result list into a regular array (Array.from(e.results)).
    //Takes the best (first) alternative from each result.
    recognition.addEventListener("result", (e) => {
        const transcript = Array.from(e.results)
            .map(result => result[0])
            .map(result => result.transcript)
            .join('');

        typingForm.querySelector(".typing-input").value = transcript; // Set the input value to the transcript
    });

    // Handle recognition end
    //event listeners allow your code to "listen" for user interactions
    //UI Interaction via Event Listener
    recognition.addEventListener("end", () => {
        isListening = false;
        voiceInputButton.classList.remove("listening");
        voiceInputButton.innerText = "mic";
    });

    // Handle recognition errors
    recognition.addEventListener("error", (event) => {
        console.error("Speech Recognition Error:", event.error);
        isListening = false;
        voiceInputButton.classList.remove("listening");
        voiceInputButton.innerText = "mic";
    });
} else {
    console.error("Speech Recognition is not supported in this browser");
    voiceInputButton.style.display = "none"; // Hide the button if not supported
}

// Toggle voice recognition when the microphone button is clicked
//microphone start hoga
voiceInputButton.addEventListener("click", () => {
    if (!SpeechRecognition) {
        alert("Speech recognition is not supported in your browser. Please try Chrome, Edge, or Safari.");
        return;
    }

    if (!isListening) {
        // Start listening
        recognition.start();
        isListening = true; 
        voiceInputButton.classList.add("listening");
        voiceInputButton.innerText = "mic_off"; // Change icon to indicate active mic
    } else {
        // Stop listening
        recognition.stop();
        isListening = false;  //bot is no longer listening
        voiceInputButton.classList.remove("listening");
        voiceInputButton.innerText = "mic";
    }
});

// Pause/Resume typing output
pauseOutputButton.addEventListener("click", () => {
    if (!isResponseGenerating) return;
    
    isTypingPaused = !isTypingPaused;
    
    if (isTypingPaused) {
        // Pause typing
        pauseOutputButton.innerText = "play_arrow";
        pauseOutputButton.classList.add("paused");
        
        // Clear the current interval if it exists
        if (currentTypingInterval) {
            clearInterval(currentTypingInterval);
            currentTypingInterval = null;
        }
        
        // Stop any ongoing speech synthesis
        stopSpeech();
    } else {
        // Resume typing
        pauseOutputButton.innerText = "pause";
        pauseOutputButton.classList.remove("paused");
        
        // Resume typing if we have stored typing data
        if (typingData) {
            const { text, textElement, incomingMessageDiv, currentWordIndex, words } = typingData;
            showTypingEffect(text, textElement, incomingMessageDiv, currentWordIndex);
        }
    }
});

// API Configuration
const API_KEY = "AIzaSyB33tRDH8HGPO3jaMp3Opok_hayF3EG7i8"; //  API key
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

// Load Initial State
const loadInitialState = () => {
    const isLightMode = document.body.classList.contains("light_mode");
    toggleThemeButton.innerText = isLightMode ? "dark_mode" : "light_mode";
    pauseOutputButton.innerText = "pause";


    
    // Load chat history
    loadChatHistory();
    
    // If there are no messages, show the header
    if (chatHistory.length === 0) {
        document.body.classList.remove("hide-header");
    } else {
        document.body.classList.add("hide-header");
    }
    
    chatContainer.scrollTo(0, chatContainer.scrollHeight);
};

// Create Message Element
const createMessageElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
};

// Format chat history for API context
const formatChatHistoryForAPI = () => {
    return chatHistory.map(message => ({
        role: message.role,
        parts: [{ text: message.content }]
    }));
};

// Show Typing Effect with improved pause/resume functionality
const showTypingEffect = (text, textElement, incomingMessageDiv, startIndex = 0) => {
    const words = text.split(' ');
    let currentWordIndex = startIndex;
    
    // Store typing data for potential pause/resume
    typingData = { text, textElement, incomingMessageDiv, currentWordIndex, words };
    
    // Clear any existing interval
    if (currentTypingInterval) {
        clearInterval(currentTypingInterval);
    }
    
    // If the button is in "show all" mode, display the entire text at once
    if (pauseOutputButton.innerText === "skip_next") {
        textElement.innerText = text;
        incomingMessageDiv.querySelector(".icon").classList.remove("hide");
        isResponseGenerating = false;
        typingData = null;
        pauseOutputButton.innerText = "pause";
        pauseOutputButton.classList.remove("paused");
        speakResponse(text);
        
        // Save the complete assistant response to history
        addMessageToHistory('assistant', text);
        return;
    }

    currentTypingInterval = setInterval(() => {
        // If paused, just return without doing anything
        if (isTypingPaused) {
            return;
        }
        
        textElement.innerText += (currentWordIndex === startIndex ? '' : ' ') + words[currentWordIndex++];
        incomingMessageDiv.querySelector(".icon").classList.add("hide");
        
        // Update the typingData with current progress
        typingData.currentWordIndex = currentWordIndex;

        if (currentWordIndex === words.length) {
            clearInterval(currentTypingInterval);
            currentTypingInterval = null;
            isResponseGenerating = false;
            typingData = null;
            incomingMessageDiv.querySelector(".icon").classList.remove("hide");
            
            // Reset pause button state
            pauseOutputButton.innerText = "pause";
            pauseOutputButton.classList.remove("paused");
            
            // Save the complete assistant response to history
            addMessageToHistory('assistant', text);
            
            // Speak the response when typing is complete
            speakResponse(text);
        }
        chatContainer.scrollTo(0, chatContainer.scrollHeight);
    }, 75);
};

// Double-click handler to instantly show the full message
const handleDoubleClickToShowFull = (event) => {
    // Only proceed if we're in the middle of typing
    if (!isResponseGenerating || !typingData) return;
    
    const messageElement = event.target.closest('.message');
    if (!messageElement || !messageElement.classList.contains('incoming')) return;
    
    // Clear the typing interval
    if (currentTypingInterval) {
        clearInterval(currentTypingInterval);
        currentTypingInterval = null;
    }
    
    // Display the full message
    const textElement = messageElement.querySelector('.text');
    textElement.innerText = typingData.text;
    
    // Save the complete assistant response to history
    addMessageToHistory('assistant', typingData.text);
    
    // Reset states
    isResponseGenerating = false;
    isTypingPaused = false;
    typingData = null;
    
    // Reset the pause button
    pauseOutputButton.innerText = "pause";
    pauseOutputButton.classList.remove("paused");
    
    // Show the copy icon
    messageElement.querySelector(".icon").classList.remove("hide");
    
    // Speak the response
    speakResponse(textElement.innerText);
};

// Add event listener for double-clicking on messages to show full text
chatContainer.addEventListener('dblclick', handleDoubleClickToShowFull);

// Generate API Response with chat history context
const generateAPIResponse = async (incomingMessageDiv) => {
    const textElement = incomingMessageDiv.querySelector(".text");

    try {
        // Format history for API
        const formattedHistory = formatChatHistoryForAPI();
        
        // Add the current user message to the formatted history
        formattedHistory.push({
            role: "user",
            parts: [{ text: userMessage }]
        });
        
//The function makes a POST request to the API (the URL is stored in API_URL).
// It sends the formatted chat history as part of the request body, along with a generation configuration.
//  These parameters control how the response is generated:

//The POST method indicates that this is a POST request,
//  typically used when you want to send data to the server to create or update a resource.

        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: formattedHistory,
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                }
            }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error.message);

        const apiResponse = data?.candidates[0].content.parts[0].text.replace(/\*\*(.*?)\*\*/g, '$1');
        
        // Enable the pause button since we're about to start typing
        pauseOutputButton.innerText = "pause";
        pauseOutputButton.classList.remove("paused");
        isTypingPaused = false;
        
        // Start typing effect
        showTypingEffect(apiResponse, textElement, incomingMessageDiv);
    } catch (error) {
        isResponseGenerating = false;
        textElement.innerText = error.message;
        textElement.parentElement.closest(".message").classList.add("error");
        
        // Save error message to history
        addMessageToHistory('assistant', error.message);
    } finally {
        incomingMessageDiv.classList.remove("loading");
    }
};

// Show Loading Animation
const showLoadingAnimation = () => {
    const html = `<div class="message-content">
                    <img class="avatar" src="images/user1.svg" alt="searching">
                    <p class="text"></p>
                    <div class="loading-indicator">
                        <div class="loading-bar"></div>
                        <div class="loading-bar"></div>
                        <div class="loading-bar"></div>
                    </div>
                </div>
                  <span onClick="copyMessage(this)" class="icon material-symbols-rounded">content_copy</span>`;
    
    const incomingMessageDiv = createMessageElement(html, "incoming", "loading");
    chatContainer.appendChild(incomingMessageDiv);
    chatContainer.scrollTo(0, chatContainer.scrollHeight);
    generateAPIResponse(incomingMessageDiv);
};

// Copy Message Function - make available to HTML onclick handlers
window.copyMessage = (copyButton) => {
    const messageText = copyButton.parentElement.querySelector(".text").innerText;

    navigator.clipboard.writeText(messageText);
    copyButton.innerText = "done";
    setTimeout(() => copyButton.innerText = "content_copy", 1000);
};

// Handle Outgoing Chat
const handleOutgoingChat = () => {
    userMessage = typingForm.querySelector(".typing-input").value.trim() || userMessage;
    if (!userMessage || isResponseGenerating) return;

    isResponseGenerating = true;

    const html = `<div class="message-content">
                    <img class="avatar" src="images/user1.svg" alt="User avatar">
                    <p class="text"></p>
                  </div>`;

    const outgoingMessageDiv = createMessageElement(html, "outgoing");
    outgoingMessageDiv.querySelector(".text").innerText = userMessage;
    chatContainer.appendChild(outgoingMessageDiv);
    
    // Save user message to history
    addMessageToHistory('user', userMessage);

    typingForm.reset(); // Clear the input field
    document.body.classList.add("hide-header");
    chatContainer.scrollTo(0, chatContainer.scrollHeight);
    setTimeout(showLoadingAnimation, 500);
};

// Delete Chat Functionality
deleteChatButton.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear the chat? This will delete your chat history.")) {
        chatContainer.innerHTML = ''; // Clear the chat
        chatHistory = []; // Clear chat history
        saveChatHistory(); // Save empty history
        document.body.classList.remove("hide-header");
        
        // Also stop any ongoing speech when chat is cleared
        stopSpeech();
    }
});

// Suggestions Click Event
suggestions.forEach(suggestion => {
    suggestion.addEventListener("click", () => {
        userMessage = suggestion.querySelector(".text").innerText;
        handleOutgoingChat();
    });
});

// Form Submission Event
typingForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleOutgoingChat();
});

toggleThemeButton.addEventListener("click", () => {
    const isLightMode = document.body.classList.toggle("light_mode");
    toggleThemeButton.innerText = isLightMode ? "dark_mode" : "light_mode";
});

// Make copyMessage function global so it can be called from HTML
window.copyMessage = copyMessage;

// Load Initial State
loadInitialState();