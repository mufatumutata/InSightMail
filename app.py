from flask import Flask, request, jsonify
from flask_cors import CORS
from openai_helper import (summarize_email, generate_email, generate_response, 
                           generate_answer, improve_email, regenerate_response, 
                           shorten_email, expand_email, store_response, retrieve_response_chain, generate_full_response_from_reply, generate_custom_response, extract_action_items, generate_email_with_reference, detect_phishing_openai)
from dotenv import load_dotenv
import os
import logging

# Set logging level to INFO
logging.basicConfig(level=logging.INFO)

load_dotenv()  # Load environment variables from .env file

app = Flask(__name__)
CORS(app)  # Allow CORS for all domains

# Store responses in memory (simple list for now, can be improved later)
response_chain = []
memory_store = {}

@app.route('/')
def index():
    return "Welcome to the Email Assistant API!"

# Summarize email content
@app.route('/summarize', methods=['POST'])
def summarize():
    try:
        data = request.get_json()
        email_content = data.get('content')
        if not email_content:
            return jsonify({'error': 'No content provided'}), 400

        summary = summarize_email(email_content)
        return jsonify({'summary': summary})

    except Exception as e:
        logging.exception("Error summarizing email")
        return jsonify({'error': 'An internal error occurred'}), 500

# Write email from scratch based on a prompt
@app.route('/write', methods=['POST'])
def write_email():
    data = request.get_json()
    prompt = data.get('prompt')
    if not prompt:
        return jsonify({'error': 'No prompt provided'}), 400
    
    email_content = generate_email(prompt)
    store_response(email_content, response_chain)  # Store response in memory
    return jsonify({'email_content': email_content})

@app.route('/respond', methods=['POST'])
def respond_email():
    try:
        data = request.get_json()
        email_content = data.get('content')
        if not email_content:
            return jsonify({'error': 'No content provided'}), 400

        # Generate multiple quick responses
        responses = generate_response(email_content, quick=True)
        return jsonify({'responses': responses})

    except Exception as e:
        logging.exception("Error generating responses")
        return jsonify({'error': 'Internal error occurred'}), 500


# Generate full response based on a short reply
@app.route('/generateFullResponse', methods=['POST'])
def generate_full_response():
    try:
        data = request.get_json()
        short_reply = data.get('reply')

        if not short_reply:
            return jsonify({'error': 'No reply text provided'}), 400

        # Generate the full response based on the short reply
        full_response = generate_full_response_from_reply(short_reply)
        return jsonify({'fullResponse': full_response})

    except Exception as e:
        logging.exception("Error generating full response")
        return jsonify({'error': 'Internal error occurred'}), 500



# Dictionary to store question-answer chains based on email content (or a conversation ID)
question_answer_store = {}

@app.route('/ask', methods=['POST'])
def ask():
    try:
        data = request.get_json()
        email_content = data.get('content').strip()  # Normalize email content to prevent differences
        question = data.get('question')

        if not email_content or not question:
            return jsonify({'error': 'Content or question missing'}), 400

        # Call function to generate an answer based on email content and question
        answer = generate_answer(email_content, question)

        # Ensure the email content is consistently formatted as a key (normalize and trim)
        email_key = email_content.strip()

        # If email content not already in the store, initialize an empty list for Q&A chain
        if email_key not in question_answer_store:
            question_answer_store[email_key] = []  # Initialize an empty list if this is the first question

        # Append the new question-answer pair to the Q&A chain
        question_answer_store[email_key].append({'question': question, 'answer': answer})

        # Return the full chain of Q&A for this email
        return jsonify({
            'answer': answer,
            'questionChain': question_answer_store[email_key]  # Return full chain of Q&A
        })
    except Exception as e:
        logging.exception("Error answering question about the email")
        return jsonify({'error': 'Internal error occurred'}), 500





# Improve existing email
@app.route('/improve', methods=['POST'])
def improve():
    data = request.get_json()
    email_content = data.get('content')
    improvement_suggestion = data.get('suggestion')

    improved_email = improve_email(email_content, improvement_suggestion)
    store_response(improved_email, response_chain)  # Store improved response
    return jsonify({'improvedEmail': improved_email})

# Regenerate a response
@app.route('/regenerate', methods=['POST'])
def regenerate():
    data = request.get_json()
    email_content = data.get('content')

    regenerated_email = regenerate_response(email_content)
    store_response(regenerated_email, response_chain)  # Store regenerated response
    return jsonify({'regeneratedEmail': regenerated_email})

# Shorten a response
@app.route('/shorten', methods=['POST'])
def shorten():
    data = request.get_json()
    email_content = data.get('content')

    shortened_email = shorten_email(email_content)
    store_response(shortened_email, response_chain)  # Store shortened response
    return jsonify({'shortenedEmail': shortened_email})

# Expand a response
@app.route('/expand', methods=['POST'])
def expand():
    data = request.get_json()
    email_content = data.get('content')

    expanded_email = expand_email(email_content)
    store_response(expanded_email, response_chain)  # Store expanded response
    return jsonify({'expandedEmail': expanded_email})

# Retrieve stored response chain (memory)
@app.route('/retrieveResponseChain', methods=['GET'])
def retrieve_chain():
    response_chain_list = retrieve_response_chain(response_chain)
    return jsonify({'responseChain': response_chain_list})

# New memory endpoints
@app.route('/memory', methods=['POST'])
def store_memory():
    try:
        data = request.get_json()
        conversation_id = data.get('conversationId')
        memory_data = data.get('memoryData')

        if not conversation_id or not memory_data:
            return jsonify({'error': 'Missing conversation ID or memory data'}), 400

        # Store memory in the dictionary with conversationId as key
        memory_store[conversation_id] = memory_data
        return jsonify({'message': f"Memory stored for conversation ID {conversation_id}"})

    except Exception as e:
        app.logger.exception("Error storing memory")
        return jsonify({'error': 'Internal error occurred'}), 500

@app.route('/get_memory', methods=['POST'])
def get_memory():
    try:
        data = request.get_json()
        conversation_id = data.get('conversationId')

        if not conversation_id:
            return jsonify({'error': 'Missing conversation ID'}), 400

        # Retrieve memory data from the dictionary
        memory_data = memory_store.get(conversation_id)
        if memory_data:
            return jsonify({'memoryData': memory_data})
        else:
            return jsonify({'error': 'No memory found for conversation ID'})

    except Exception as e:
        app.logger.exception("Error retrieving memory")
        return jsonify({'error': 'Internal error occurred'}), 500
    
@app.route('/customRespond', methods=['POST'])
def custom_respond():
    try:
        data = request.get_json()
        email_content = data.get('content')
        custom_prompt = data.get('prompt')

        if not email_content or not custom_prompt:
            return jsonify({'error': 'Email content or custom prompt missing'}), 400

        # Generate a response based on both the email content and the custom prompt
        custom_response = generate_custom_response(email_content, custom_prompt)
        return jsonify({'response': custom_response})

    except Exception as e:
        logging.exception("Error generating custom response")
        return jsonify({'error': 'Internal error occurred'}), 500

@app.route('/actionItems', methods=['POST'])
def action_items():
    try:
        data = request.get_json()
        email_content = data.get('content')

        if not email_content:
            return jsonify({'error': 'No content provided'}), 400

        # Call the function to extract action items from the email content
        action_items = extract_action_items(email_content)
        return jsonify({'actionItems': action_items})

    except Exception as e:
        logging.exception("Error extracting action items")
        return jsonify({'error': 'An internal error occurred'}), 500
    
@app.route('/writeWithReference', methods=['POST'])
# Write email from scratch referring to another email's content
@app.route('/writeWithReference', methods=['POST'])
def write_email_with_reference():
    data = request.get_json()
    prompt = data.get('prompt')
    email_content = data.get('content')
    if not prompt or not email_content:
        return jsonify({'error': 'No prompt or email content provided'}), 400

    # Use the custom function to generate an email that references the existing email content
    email_content_with_reference = generate_email_with_reference(prompt, email_content)
    return jsonify({'email_content': email_content_with_reference})


@app.route('/phishingStatus', methods=['POST'])
def phishing_status():
    try:
        data = request.get_json()
        email_content = data.get('content')
        
        if not email_content:
            return jsonify({'phishingStatus': 'Error: No content provided'}), 400
        
        # Use the OpenAI-based phishing detection function
        status = detect_phishing_openai(email_content)
        
        # Validate the response to ensure it only returns expected values
        if status not in ['POTENTIAL PHISHING', 'NO PHISHING DETECTED']:
            status = 'NO PHISHING DETECTED'  # Default to safe if unsure

        return jsonify({'phishingStatus': status})

    except Exception as e:
        logging.exception("Error detecting phishing")
        return jsonify({'phishingStatus': 'Error detecting phishing'}), 500





    
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))  # Use the port provided by Heroku or default to 5000
    app.run(host='0.0.0.0', port=port, debug=False)  # Set debug=False for production


