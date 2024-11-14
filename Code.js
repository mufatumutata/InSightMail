function onHomepage(e) {
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('InSightMail Assistant'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText('Open an email to access our AI assistant'))
      .addWidget(CardService.newTextParagraph().setText('<b>OR</b>'))
      .addWidget(CardService.newTextButton()
        .setText('Compose New Email')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(CardService.newAction().setFunctionName('composeEmail')))
    )
    .build();
  return card;
}


function getGmailMessage(e) {
  var messageId = e.gmail.messageId;
  return GmailApp.getMessageById(messageId);
}

function getMessageBody(message) {
  return message.getPlainBody();
}

function getSummaryFromAPI(emailContent) {
  if (!emailContent) {
    return 'No content to summarize.';
  }

  const url = 'https://ancient-chamber-92271-606ef689572e.herokuapp.com/summarize';
  const options = {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify({ content: emailContent })
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    return result.summary || 'Error summarizing email.';
  } catch (error) {
    return 'Error: ' + error.message;
  }
}


function getActionItemsFromAPI(emailContent) {
  const url = 'https://ancient-chamber-92271-606ef689572e.herokuapp.com/actionItems';
  const options = {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify({ content: emailContent })
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    return result.actionItems || 'No apparent action items.';
  } catch (error) {
    return 'No action items available.';
  }
}


function generateAnswer(e) {
  const formInputs = e.commonEventObject.formInputs;

  if (!formInputs || !formInputs.emailQuestion || !formInputs.emailQuestion[''].stringInputs || formInputs.emailQuestion[''].stringInputs.value.length === 0) {
    return showErrorCard('No question provided. Please enter a question.');
  }

  const emailQuestion = formInputs.emailQuestion[''].stringInputs.value[0];
  const emailContent = e.parameters.emailContent;
  const messageId = e.gmail.messageId;

  const url = 'https://ancient-chamber-92271-606ef689572e.herokuapp.com/ask';
  const options = {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify({ content: emailContent, question: emailQuestion })
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    const answer = result.answer || 'Error generating answer.';

    // Retrieve or initialize the question chain for this messageId
    const questionChainString = PropertiesService.getUserProperties().getProperty("questionChain_" + messageId) || "[]";
    const updatedQuestionChain = JSON.parse(questionChainString);
    updatedQuestionChain.push({ question: emailQuestion, answer: answer });

    // Save the updated question chain
    PropertiesService.getUserProperties().setProperty("questionChain_" + messageId, JSON.stringify(updatedQuestionChain));

    return CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle('Email Search Result'))
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText('<b>Q:</b> ' + emailQuestion + '<br><b>A:</b> ' + answer)))
      .addSection(createToggleChatHistoryButtonSection(emailContent, updatedQuestionChain, true))
      .build();

  } catch (error) {
    return showErrorCard('Error generating answer: ' + error.message);
  }
}

function showEmailActions(e) {
  const message = getGmailMessage(e);
  const emailContent = getMessageBody(message);

  if (!emailContent) {
    return showErrorCard('Unable to read email content.');
  }

  // Fetch email summary
  const summary = getSummaryFromAPI(emailContent);
  if (!summary) {
    return showErrorCard('Unable to summarize email.');
  }

  // Detect phishing status with API call
  const phishingStatus = getPhishingStatusFromAPI(emailContent);

  // Define phishing status display using emoji as color indicator
  var phishingStatusText;
  var emojiColor;

  if (phishingStatus === "POTENTIAL PHISHING") {
    phishingStatusText = "<b>POTENTIAL PHISHING</b>";
    emojiColor = "🔴";  // Red circle emoji for phishing
  } else if (phishingStatus === "NO PHISHING DETECTED") {
    phishingStatusText = "<b>NO PHISHING DETECTED</b>";
    emojiColor = "🟢";  // Green circle emoji for safe
  } else {
    phishingStatusText = "<b>PHISHING STATUS UNKNOWN</b>";
    emojiColor = "⚪";  // White circle emoji for unknown status
  }

  // Create phishing status widget using emoji as color indicator
  const phishingStatusWidget = CardService.newDecoratedText()
    .setText(emojiColor + " " + phishingStatusText)
    .setWrapText(true);

  // Create the main card with summary, phishing status, and other functionalities
  const cardBuilder = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('InSightMail Assistant'))
    .addSection(CardService.newCardSection()
      .addWidget(phishingStatusWidget)
      .addWidget(CardService.newTextParagraph().setText("<b>Summary:</b> " + summary))
    )
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextInput()
        .setFieldName('emailQuestion')
        .setTitle('Ask about this email')
        .setHint('Enter a question')
      )
      .addWidget(CardService.newTextButton()
        .setText('Search Email')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('generateAnswer')
            .setParameters({ 'emailContent': emailContent })
        )
      )
    )
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextButton()
          .setText('Action Items')
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName('showActionItems')
              .setParameters({ 'emailContent': emailContent })
          )
        )
        .addWidget(CardService.newTextButton()
          .setText('Suggested Responses')
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName('showQuickResponses')
              .setParameters({ 'emailContent': emailContent })
          )
        )
    )
    .addSection(createCustomResponseSection(emailContent))
    .addSection(createGenerateEmailSectionWithReference(emailContent));

  return cardBuilder.build();
}




function getPhishingStatusFromAPI(emailContent) {
  const url = 'https://ancient-chamber-92271-606ef689572e.herokuapp.com/phishingStatus';
  const options = {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify({ content: emailContent })
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    return result.phishingStatus || "Error";
  } catch (error) {
    console.error('Error fetching phishing status:', error);
    return "Error detecting phishing";
  }
}




function detectPhishingStatus(emailContent) {
  const url = 'https://ancient-chamber-92271-606ef689572e.herokuapp.com/phishingStatus';
  const options = {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify({ content: emailContent })
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    return result.phishingStatus || "UNKNOWN";
  } catch (error) {
    return "Error detecting phishing: " + error.message;
  }
}


function createCardWithContent(summary, emailContent, questionChain, phishingStatus, showChatHistory) {
  const cardBuilder = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('InSightMail Assistant')
        .setImageUrl('https://drive.google.com/uc?export=view&id=1CmnnykXUIzbnuDXV73vPEjZptvcBtcpN')
    );

  // Add phishing status indicator at the top using the placeholder status
  const phishingLabel = createPhishingStatusLabel(phishingStatus);
  cardBuilder.addSection(phishingLabel);

  // Use placeholder summary for testing
  cardBuilder.addSection(
    CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText(summary))
      .addWidget(CardService.newTextInput()
        .setFieldName('emailQuestion')
        .setTitle('Ask about this email')
        .setHint('Enter a question')
      )
      .addWidget(CardService.newTextButton()
        .setText('Search Email')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('generateAnswer')
            .setParameters({ 'emailContent': emailContent })
        )
      )
  )
  .addSection(createCustomResponseSection(emailContent))
  .addSection(createGenerateEmailSectionWithReference(emailContent));

  // Optionally add chat history
  if (showChatHistory && questionChain.length > 0) {
    cardBuilder.addSection(createQuestionChainSection(questionChain));
  }

  console.log("Testing createCardWithContent function - using placeholder summary and phishing label.");
  return cardBuilder.build();
}


function createPhishingStatusLabel(phishingStatus) {
  var section = CardService.newCardSection();
  var text;
  var color;

  // Use placeholder status without relying on API response
  if (phishingStatus === "POTENTIAL PHISHING") {
    text = "POTENTIAL PHISHING";
    color = "#FF6347"; // Tomato red color for warning
  } else if (phishingStatus === "NOT PHISHING") {
    text = "NOT PHISHING";
    color = "#32CD32"; // Lime green color for safe
  } else {
    text = "UNKNOWN";
    color = "#CCCCCC"; // Gray for unknown status
  }

  // Add the phishing status as a label with styling
  section.addWidget(CardService.newTextButton()
    .setText(text)
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setDisabled(true) // Make it non-clickable
    .setBackgroundColor(color)
  );

  console.log("Testing createPhishingStatusLabel function - using placeholder phishing status.");
  return section;
}


// Function to create the Show Chat History button section
function createShowChatHistoryButtonSection(emailContent) {
  const section = CardService.newCardSection();
  section.addWidget(CardService.newTextButton()
    .setText('Show Chat History')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(CardService.newAction()
      .setFunctionName('showChatHistory')
      .setParameters({ 'emailContent': emailContent })));
  return section;
}

function createToggleChatHistoryButtonSection(emailContent, questionChain, showChatHistory) {
  const section = CardService.newCardSection();

  const buttonText = showChatHistory ? 'Hide Chat History' : 'Show Chat History';
  const functionName = showChatHistory ? 'hideChatHistory' : 'showChatHistory';

  section.addWidget(CardService.newTextButton()
    .setText(buttonText)
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(CardService.newAction()
      .setFunctionName(functionName)
      .setParameters({ 'emailContent': emailContent })));

  if (showChatHistory) {
    questionChain.forEach(function(qa) {
      section.addWidget(CardService.newTextParagraph().setText('<b>Q:</b> ' + qa.question + '<br><b>A:</b> ' + qa.answer));
    });
  }

  return section;
}



function createIconButton(text, iconUrl, functionName, params) {
  return CardService.newTextButton()
    .setText(text)
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setIconUrl(iconUrl)
    .setOnClickAction(CardService.newAction()
      .setFunctionName(functionName)
      .setParameters(params));
}

function createImproveEmailSection(emailContent) {
  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('<b>IMPROVE:</b>'))
    .addWidget(CardService.newTextInput()
      .setFieldName('improvePrompt')
      .setTitle('Enter suggestions to improve email'));

  const buttonRow = CardService.newButtonSet()
    .addButton(CardService.newImageButton()
      .setIconUrl('https://drive.google.com/uc?export=view&id=1IAByeCobBQ1kDc0Hy1-FwNJwadTvG8n3')
      .setAltText('Rewrite')
      .setOnClickAction(CardService.newAction()
        .setFunctionName('improveEmail')
        .setParameters({ 'emailContent': emailContent })))
    .addButton(CardService.newImageButton()
      .setIconUrl('https://drive.google.com/uc?export=view&id=1jatTiwBjVn8KSqt_AuRB0MAPwlgoGPAt')
      .setAltText('Shorten')
      .setOnClickAction(CardService.newAction()
        .setFunctionName('shortenEmail')
        .setParameters({ 'emailContent': emailContent })))
    .addButton(CardService.newImageButton()
      .setIconUrl('https://drive.google.com/uc?export=view&id=1nurbslKabKrxMsJWjfx2fSzp0VvO058x')
      .setAltText('Expand')
      .setOnClickAction(CardService.newAction()
        .setFunctionName('expandEmail')
        .setParameters({ 'emailContent': emailContent })))
    .addButton(CardService.newImageButton()
      .setIconUrl('https://drive.google.com/uc?export=view&id=1CnDR-Iy_ALCaHn6vLBeEcqsC7iQjfB_9')
      .setAltText('Regenerate')
      .setOnClickAction(CardService.newAction()
        .setFunctionName('regenerateEmail')
        .setParameters({ 'emailContent': emailContent })));

  section.addWidget(buttonRow);
  return section;
}

function showActionItems(e) {
  const emailContent = e.parameters.emailContent;
  const actionItems = getActionItemsFromAPI(emailContent);

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Action Items'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText(actionItems || 'No action items available.')))
    .build();
}

// Function to handle displaying suggested responses
function showQuickResponses(e) {
  const emailContent = e.parameters.emailContent;
  return createQuickRepliesSection(emailContent);
}

// Function to create quick replies section based on API response
function createQuickRepliesSection(emailContent) {
  const section = CardService.newCardSection().addWidget(CardService.newTextParagraph());
  const url = 'https://ancient-chamber-92271-606ef689572e.herokuapp.com/respond';
  const options = {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify({ content: emailContent })
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    const replies = result.responses || [];

    replies.forEach(function(reply, index) {
      section.addWidget(CardService.newTextParagraph().setText(reply));
      section.addWidget(CardService.newTextButton()
        .setText('Use Response ' + (index + 1))
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(CardService.newAction().setFunctionName('generateFullResponse')
          .setParameters({ 'replyText': reply })));
    });
  } catch (error) {
    section.addWidget(CardService.newTextParagraph().setText('Unable to fetch quick replies.'));
  }

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Suggested Responses'))
    .addSection(section)
    .build();
}

// Function to handle composing new email from scratch
function composeEmail() {
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Compose a New Email'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextInput()
        .setFieldName('emailPrompt')
        .setTitle('Enter prompt for new email'))
      .addWidget(CardService.newTextButton()
        .setText('Generate')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(CardService.newAction().setFunctionName('generateEmailFromScratch')))
    )
    .build();

  return card;
}

// New function: Create custom response section based on email content and user prompt
function createCustomResponseSection(emailContent) {
  const section = CardService.newCardSection().addWidget(CardService.newTextParagraph().setText('<b>Compose a Custom Reply</b>:'));

  const textInput = CardService.newTextInput().setFieldName('customPrompt').setTitle('Enter prompt for new response');
  const generateResponseButton = CardService.newTextButton()
    .setText('Generate Custom Response').setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(CardService.newAction().setFunctionName('generateCustomResponse')
      .setParameters({ 'emailContent': emailContent }));

  section.addWidget(textInput);
  section.addWidget(generateResponseButton);

  return section;
}

// Function to handle custom response generation based on user input and email content
function generateCustomResponse(e) {
  const formInputs = e.commonEventObject.formInputs;

  if (!formInputs || !formInputs.customPrompt || !formInputs.customPrompt[''].stringInputs || formInputs.customPrompt[''].stringInputs.value.length === 0) {
    return showErrorCard('No prompt provided. Please enter a prompt.');
  }

  const customPrompt = formInputs.customPrompt[''].stringInputs.value[0];
  const emailContent = e.parameters.emailContent;

  const url = 'https://ancient-chamber-92271-606ef689572e.herokuapp.com/customRespond';
  const options = {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify({ content: emailContent, prompt: customPrompt })
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    const customResponse = result.response || 'Error generating custom response.';

    return CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle('Draft'))
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText(customResponse)))
      .addSection(createImproveEmailSection(customResponse))
      .build();
  } catch (error) {
    return showErrorCard('An error occurred: ' + error);
  }
}

// Function to generate a full response when "Use" is clicked
function generateFullResponse(e) {
  const replyText = e.parameters.replyText;

  const url = 'https://ancient-chamber-92271-606ef689572e.herokuapp.com/generateFullResponse';
  const options = {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify({ reply: replyText })
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    const fullResponse = result.fullResponse || 'Error generating full response.';

    return CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle('Draft'))
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText(fullResponse)))
      .addSection(createImproveEmailSection(fullResponse))
      .build();
  } catch (error) {
    return showErrorCard('Error generating full response: ' + error);
  }
}

// Function to handle improving the email
function improveEmail(e) {
  const formInputs = e.commonEventObject.formInputs;

  if (!formInputs || !formInputs.improvePrompt || !formInputs.improvePrompt[''].stringInputs || formInputs.improvePrompt[''].stringInputs.value.length === 0) {
    return showErrorCard('No suggestions provided. Please provide suggestions for improvements.');
  }

  const improvementSuggestion = formInputs.improvePrompt[''].stringInputs.value[0];
  const emailContent = e.parameters.emailContent;

  const url = 'https://ancient-chamber-92271-606ef689572e.herokuapp.com/improve'; // API to improve email
  const options = {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify({ content: emailContent, suggestion: improvementSuggestion })
  };

  const response = UrlFetchApp.fetch(url, options);  // API call to improve email
  const result = JSON.parse(response.getContentText());
  const improvedEmail = result.improvedEmail || 'Error improving email.';

  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Draft'))
    .addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText(improvedEmail)))
    .addSection(createImproveEmailSection(improvedEmail));  // Allow user to continue improving

  return card.build();
}

// Function to shorten the email
function shortenEmail(e) {
  const emailContent = e.parameters.emailContent;

  const url = 'https://ancient-chamber-92271-606ef689572e.herokuapp.com/shorten'; // API to shorten email
  const options = {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify({ content: emailContent })
  };

  const response = UrlFetchApp.fetch(url, options);  // API call to shorten email
  const result = JSON.parse(response.getContentText());
  const shortenedEmail = result.shortenedEmail || 'Error shortening email.';

  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Draft'))
    .addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText(shortenedEmail)))
    .addSection(createImproveEmailSection(shortenedEmail));  // Continue allowing improvements

  return card.build();
}

// Function to expand the email
function expandEmail(e) {
  const emailContent = e.parameters.emailContent;

  const url = 'https://ancient-chamber-92271-606ef689572e.herokuapp.com/expand'; // API to expand email
  const options = {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify({ content: emailContent })
  };

  const response = UrlFetchApp.fetch(url, options);  // API call to expand email
  const result = JSON.parse(response.getContentText());
  const expandedEmail = result.expandedEmail || 'Error expanding email.';

  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Draft'))
    .addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText(expandedEmail)))
    .addSection(createImproveEmailSection(expandedEmail));  // Continue allowing improvements

  return card.build();
}

// Function to regenerate the email
function regenerateEmail(e) {
  const emailContent = e.parameters.emailContent;

  const url = 'https://ancient-chamber-92271-606ef689572e.herokuapp.com/regenerate'; // API to regenerate email
  const options = {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify({ content: emailContent })
  };

  const response = UrlFetchApp.fetch(url, options);  // API call to regenerate email
  const result = JSON.parse(response.getContentText());
  const regeneratedEmail = result.regeneratedEmail || 'Error regenerating email.';

  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Draft'))
    .addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText(regeneratedEmail)))
    .addSection(createImproveEmailSection(regeneratedEmail));  // Continue allowing improvements

  return card.build();
}

function generateAnswer(e) {
  const formInputs = e.commonEventObject.formInputs;

  if (!formInputs || !formInputs.emailQuestion || !formInputs.emailQuestion[''].stringInputs || formInputs.emailQuestion[''].stringInputs.value.length === 0) {
    return showErrorCard('No question provided. Please enter a question.');
  }

  const emailQuestion = formInputs.emailQuestion[''].stringInputs.value[0];
  const emailContent = e.parameters.emailContent;
  const messageId = e.gmail.messageId;

  const url = 'https://ancient-chamber-92271-606ef689572e.herokuapp.com/ask';
  const options = {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify({ content: emailContent, question: emailQuestion })
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    const answer = result.answer || 'Error generating answer.';

    // Retrieve the existing question chain for this messageId, or initialize as an empty array
    const questionChainString = PropertiesService.getUserProperties().getProperty("questionChain_" + messageId) || "[]";
    const updatedQuestionChain = JSON.parse(questionChainString);

    // Add the current question and answer to the chain for this email
    updatedQuestionChain.push({ question: emailQuestion, answer: answer });

    // Save the updated question chain back to PropertiesService using messageId as part of the key
    PropertiesService.getUserProperties().setProperty("questionChain_" + messageId, JSON.stringify(updatedQuestionChain));

    // Build and return the card with the answer and collapsible chat history for the specific email
    return CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle('Email Search'))
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText('<b>Q:</b> ' + emailQuestion + '<br><b>A:</b> ' + answer)))
      .addSection(createToggleChatHistoryButtonSection(emailContent, updatedQuestionChain, false)) // Show toggle button to expand/collapse
      .addSection(createTextBoxForFollowUpQuestion(emailContent))
      .build();

  } catch (error) {
    return showErrorCard('Error generating answer: ' + error.message);
  }
}

function createToggleChatHistoryButtonSection(emailContent, questionChain, showChatHistory) {
  const section = CardService.newCardSection();

  // Button text and function based on `showChatHistory` state
  const buttonText = showChatHistory ? 'Hide Chat History' : 'Show Chat History';
  const functionName = showChatHistory ? 'hideChatHistory' : 'showChatHistory';

  // Add the toggle button
  section.addWidget(CardService.newTextButton()
    .setText(buttonText)
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(CardService.newAction()
      .setFunctionName(functionName)
      .setParameters({ 'emailContent': emailContent })));

  // Conditionally add each chat history item if `showChatHistory` is true
  if (showChatHistory) {
    questionChain.forEach(function(qa) {
      section.addWidget(CardService.newTextParagraph().setText('<b>Q:</b> ' + qa.question + '<br><b>A:</b> ' + qa.answer));
    });
  }

  return section;
}



// Function to create the Hide Chat History button section
function createHideChatHistoryButtonSection(emailContent) {
  const section = CardService.newCardSection();
  section.addWidget(CardService.newTextButton()
    .setText('Hide Chat History')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(CardService.newAction()
      .setFunctionName('hideChatHistory')
      .setParameters({ 'emailContent': emailContent })));
  return section;
}

function showChatHistory(e) {
  const emailContent = e.parameters.emailContent;
  const messageId = e.gmail.messageId;
  
  const questionChainString = PropertiesService.getUserProperties().getProperty("questionChain_" + messageId) || "[]";
  const questionChain = JSON.parse(questionChainString);

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Email Chat History'))
    .addSection(createToggleChatHistoryButtonSection(emailContent, questionChain, true))
    .addSection(createTextBoxForFollowUpQuestion(emailContent))
    .build();
}


function hideChatHistory(e) {
  const emailContent = e.parameters.emailContent;
  const messageId = e.gmail.messageId;

  const questionChainString = PropertiesService.getUserProperties().getProperty("questionChain_" + messageId) || "[]";
  const questionChain = JSON.parse(questionChainString);

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Email Chat History'))
    .addSection(createToggleChatHistoryButtonSection(emailContent, questionChain, false))
    .addSection(createTextBoxForFollowUpQuestion(emailContent))
    .build();
}



function createQuestionChainSection(questionChain) {
  const section = CardService.newCardSection();
  section.addWidget(CardService.newTextParagraph().setText('<b>CHAT HISTORY:</b>'));

  questionChain.forEach(function(qa) {
    section.addWidget(CardService.newTextParagraph().setText('<b>Q:</b> ' + qa.question + '<br><b>A:</b> ' + qa.answer));
  });

  return section;
}



function createTextBoxForFollowUpQuestion(emailContent) {
  const section = CardService.newCardSection();
  section.addWidget(CardService.newTextInput()
    .setFieldName('emailQuestion')
    .setTitle('Ask a follow-up question')
    .setHint('Enter your question here'));

  section.addWidget(CardService.newTextButton()
    .setText('Get Answer')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(CardService.newAction()
      .setFunctionName('generateAnswer')
      .setParameters({ 'emailContent': emailContent })));

  return section;
}



// Function to create a section for generating emails from scratch
function createGenerateEmailSection() {
  const section = CardService.newCardSection();

  const textInput = CardService.newTextInput().setFieldName('emailPrompt').setTitle('Enter a prompt to generate an email');
  const generateEmailButton = CardService.newTextButton().setText('Generate Email from Scratch')
    .setOnClickAction(CardService.newAction().setFunctionName('generateEmailFromScratch'));

  section.addWidget(textInput);
  section.addWidget(generateEmailButton);
  return section;
}

// Function to generate an email referring to the current email being viewed
function createGenerateEmailSectionWithReference(emailContent) {
  const section = CardService.newCardSection().addWidget(CardService.newTextParagraph().setText('<b>Compose Draft (from current)</b>:'))

  const textInput = CardService.newTextInput().setFieldName('emailPromptWithReference').setTitle('Enter prompt for new email');
  const generateEmailButton = CardService.newTextButton().setText('Generate Email with Context').setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(CardService.newAction().setFunctionName('generateEmailWithReference')
      .setParameters({ 'emailContent': emailContent }));

  section.addWidget(textInput);
  section.addWidget(generateEmailButton);
  return section;
}

// Function to generate an email from scratch using a prompt via API
function generateEmailFromScratch(e) {
  const formInputs = e.commonEventObject.formInputs;

  if (!formInputs || !formInputs.emailPrompt || !formInputs.emailPrompt[''].stringInputs || formInputs.emailPrompt[''].stringInputs.value.length === 0) {
    return showErrorCard('No prompt provided. Please enter a prompt.');
  }

  const emailPrompt = formInputs.emailPrompt[''].stringInputs.value[0];  // Get the prompt from user input

  const url = 'https://ancient-chamber-92271-606ef689572e.herokuapp.com/write'; // API for writing email from scratch
  const options = {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify({ prompt: emailPrompt })
  };

  const response = UrlFetchApp.fetch(url, options);  // API call to generate email from scratch
  const result = JSON.parse(response.getContentText());
  const emailContent = result.email_content || 'Error generating email content.';

  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Draft'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText(emailContent))
    )
    .addSection(createImproveEmailSection(emailContent));  // Adds section to improve the email
  return card.build();
}

// Function to generate an email referring to the current email via API
function generateEmailWithReference(e) {
  const formInputs = e.commonEventObject.formInputs;
  const emailContent = e.parameters.emailContent;

  if (!formInputs || !formInputs.emailPromptWithReference || !formInputs.emailPromptWithReference[''].stringInputs || formInputs.emailPromptWithReference[''].stringInputs.value.length === 0) {
    return showErrorCard('No prompt provided. Please enter a prompt.');
  }

  const emailPromptWithReference = formInputs.emailPromptWithReference[''].stringInputs.value[0];  // Get the prompt with reference to the current email

  const url = 'https://ancient-chamber-92271-606ef689572e.herokuapp.com/writeWithReference'; // API for writing email referring to another email
  const options = {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify({ prompt: emailPromptWithReference, content: emailContent })
  };

  const response = UrlFetchApp.fetch(url, options);  // API call to generate email with reference
  const result = JSON.parse(response.getContentText());
  const emailContentWithReference = result.email_content || 'Error generating email content.';

  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Draft'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText(emailContentWithReference))
    )
    .addSection(createImproveEmailSection(emailContentWithReference));  // Adds section to improve the email
  return card.build();
}

// Function to display an error message in a card
function showErrorCard(message) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Error'))
    .addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText(message)))
    .build();
}

