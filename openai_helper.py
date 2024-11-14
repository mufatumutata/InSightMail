import openai
import os

# Load your OpenAI API key from environment variable
openai.api_key = os.getenv("OPENAI_API_KEY")

# Summarize email content
def summarize_email(email_content):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": f"Summarize the following email content: {email_content}. Be concise, but cover all the important details."}
        ]
    )
    return response.choices[0].message.content.strip()

# Generate email from prompt
def generate_email(prompt):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": f"Write an email based on the following prompt: {prompt}. Do not make up information - use the prompt appropriately!"}
        ]
    )
    return response.choices[0].message.content.strip()

# Generate multiple varied and distinct responses to an email (separate API calls for each tone)
def generate_response(email_content, quick=True):
    tones = [
        "enthusiastic, optimistic, or positive",
        "neutral or compromising",
        "hesitant, pessemistic, or negative",
        "curious or questioning"
    ]
    
    responses = []
    for tone in tones:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "user", "content": f"Generate a {tone} email response to the following email: {email_content}.  The response should be short, to the point, and should appropriately respond to what is being asked in the email. This response can be in email format, but that is not necessary; determine the structure and format of the response based on the tone of the email we are responding to. Make sure to use complete sentences."}
            ]
        )
        # Collect each response individually
        responses.append(response.choices[0].message['content'].strip())
    
    return responses  # Return the list of distinct responses



# Generate an answer for a specific question about an email
def generate_answer(email_content, question):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are an expert at analyzing emails."},
            {"role": "user", "content": f"Here is the email: {email_content}. Here is the question: {question}. Answer the question based on the email content. Be as precise with the answer if possible. If the answer is not present in the email, let the user know it is not apparent and they may have to manually review the email."}
        ]
    )
    return response.choices[0].message.content.strip()

# Improve email based on suggestion
def improve_email(email_content, suggestion):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": f"Improve the following email: {email_content}. Here are the suggestions: {suggestion}"}
        ]
    )
    return response.choices[0].message.content.strip()

# Regenerate email response
def regenerate_response(email_content):
    return generate_email(email_content)

# Shorten the email
def shorten_email(email_content):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": f"Shorten the following email: {email_content}. Make sure to cover the key points."}
        ]
    )
    return response.choices[0].message.content.strip()

# Expand the email
def expand_email(email_content):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": f"Expand the following email: {email_content}. Do not make up fake information to expand the email."}
        ]
    )
    return response.choices[0].message.content.strip()

# Store a generated response
def store_response(response, response_chain):
    response_chain.append(response)

# Retrieve the full response chain (history of responses)
def retrieve_response_chain(response_chain):
    return response_chain

# Generate full response from a short reply
def generate_full_response_from_reply(reply):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": f"Expand this reply into a full email response: {reply}. The goal of this should be to provide a complete email response; but, do not make the response too long... get to the point."}
        ]
    )
    return response.choices[0].message.content.strip()

# Generate a custom response to an email based on user input
def generate_custom_response(email_content, custom_prompt):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": f"Respond to the following email: {email_content} based on the following instructions: {custom_prompt}. Ensure the response is relevant to the email content. Do not make stuff up."}
        ]
    )
    return response.choices[0].message['content'].strip()

# Extract action items from email content
def extract_action_items(email_content):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": f"Identify the key action items from the following email: {email_content}. Action items are things the recipient of the email must do based on what they are told in an email. Provide them as a list of numbered points. If there are no obvious action items, let the user know there are 'No suggested action items'; in this case the only output should be 'No suggested action items' - do not generate ANY action items in this case; just say 'No suggested action items'. Most emails will not have action items, so only generate action items if they're really really obvious! Furthermore, be concise with action items; be concise with the length of the bullet points and the number of bullet points."}
        ]
    )
    return response.choices[0].message.content.strip()

# Generate an email from a prompt that refers to the content of the viewed email
def generate_email_with_reference(prompt, email_content):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": f"Write an email based on the following prompt: {prompt}, and refer to this email: {email_content}, if necessary."}
        ]
    )
    return response.choices[0].message.content.strip()

def detect_phishing_openai(email_content):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are an AI assistant that detects phishing."},
            {"role": "user", "content": f"Determine if the following email is phishing. Only respond with 'POTENTIAL PHISHING' if there are clear indicators, such as suspicious links, requests for sensitive information, or any other red flags that indicate phishing. Otherwise, respond with 'NO PHISHING DETECTED'. Only say an email is a phishing email if you are certain! Email content: {email_content}"}
        ]
    )
    return response.choices[0].message.content.strip()











