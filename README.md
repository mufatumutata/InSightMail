# InSightMail - Gmail Productivity Assistant

InSightMail is a Gmail add-on that enhances email management with AI-powered features. This tool is ideal for professionals, students, or anyone looking to save time and streamline their Gmail experience. InSightMail provides features like email summarization, custom responses, action item extraction, phishing detection, and more—all accessible directly within Gmail.

## Features

- **Email Summarization**: Get quick summaries of lengthy emails.
- **Custom Responses**: Generate responses based on email content and user prompts.
- **Follow-Up Questions**: Ask specific questions to clarify email details.
- **Action Item Extraction**: Identify actionable tasks from email content.
- **Contextual Drafting**: Draft emails with references to previous conversations.
- **Editing Options**: Improve, shorten, expand, or regenerate email drafts.
- **Phishing Detection**: Detect potential phishing emails for added security.

## Code Files

- **app.py**: Flask backend that processes requests from the add-on and interacts with OpenAI's API.
- **openai_helper.py**: Helper functions for AI features like summarization, response generation, and phishing detection.
- **Code.js**: Google Apps Script that creates the Gmail add-on UI and manages interactions with the backend.
- **appsscript.json**: Configuration file for the Google Apps Script.

## Usage

1. Clone the repository and install dependencies from `requirements.txt`.
2. Set your OpenAI API key in a `.env` file.
3. Deploy the backend (Flask) to a cloud service (e.g., Heroku).
4. Set up the Google Apps Script to connect with the deployed backend.

InSightMail is ready to use in Gmail, bringing AI-powered productivity features directly to your inbox.
