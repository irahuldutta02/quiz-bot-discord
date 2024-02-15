import { Client, GatewayIntentBits } from "discord.js";
import { config } from "dotenv";
config();
import fs from "fs";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const TOKEN = process.env.TOKEN;

const PREFIX = "!";
const quizChannelName = "quiz-channel";

let quizRunning = false;
let currentQuestionIndex = 0;
let participants = {};
let questions = [
  {
    type: "multiple_choice",
    question: "Which keyword is used to declare a variable in JavaScript?",
    choices: ["var", "let", "const", "both a and b"],
    correctAnswer: "both a and b",
  },
  {
    type: "true_false",
    question: "JavaScript is a statically-typed language.",
    correctAnswer: false,
  },
  {
    type: "short_answer",
    question: "What does 'DOM' stand for in JavaScript?",
    acceptableAnswers: ["document object model"],
  },
  {
    type: "multiple_choice",
    question: "What is the purpose of the 'this' keyword in JavaScript?",
    choices: [
      "Refers to the current function",
      "Refers to the global object",
      "Refers to the object the function is a method of",
      "None of the above",
    ],
    correctAnswer: "Refers to the object the function is a method of",
  },
  {
    type: "true_false",
    question: "JavaScript is a case-sensitive language.",
    correctAnswer: true,
  },
  {
    type: "short_answer",
    question: "What is a closure in JavaScript?",
    acceptableAnswers: ["a function with access to its own scope, the outer function's scope, and the global scope"],
  },
  {
    type: "multiple_choice",
    question: "Which built-in method can be used to sort an array in JavaScript?",
    choices: ["sortArray()", "order()", "arrange()", "sort()"],
    correctAnswer: "sort()",
  },
  {
    type: "true_false",
    question: "JavaScript is primarily a server-side scripting language.",
    correctAnswer: false,
  },
  {
    type: "short_answer",
    question: "What is the purpose of 'addEventListener' in JavaScript?",
    acceptableAnswers: ["attach an event handler to an element"],
  },
  {
    type: "multiple_choice",
    question: "What is the difference between '==' and '===' in JavaScript?",
    choices: [
      "'==' performs type coercion, while '===' does not",
      "'===' performs type coercion, while '==' does not",
      "Both are equivalent and interchangeable",
      "None of the above",
    ],
    correctAnswer: "'==' performs type coercion, while '===' does not",
  },
];

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", (message) => {
  if (message.author.bot) return;
  if (message.channel.name !== quizChannelName) return;

  if (
    message.content.startsWith(`${PREFIX}startquiz`) &&
    message.channel.name === quizChannelName
  ) {
    startQuiz(message);
  } else if (
    message.content.startsWith(`${PREFIX}stopquiz`) &&
    message.channel.name === quizChannelName
  ) {
    stopQuiz(message);
  } else if (quizRunning && message.channel.name === quizChannelName) {
    handleQuizResponse(message);
  }
});

function startQuiz(message) {
  quizRunning = true;
  currentQuestionIndex = 0;
  participants = {};

  sendQuestion(message.channel);
}

function stopQuiz(message) {
  quizRunning = false;
  currentQuestionIndex = 0;
  participants = {};

  message.channel.send("Quiz stopped.");
}

function sendQuestion(channel) {
  const questionData = questions[currentQuestionIndex];

  if (questionData) {
    channel.send(
      `**Question ${currentQuestionIndex + 1}**\n${questionData.type}`
    );

    switch (questionData.type) {
      case "multiple_choice":
        sendMultipleChoiceQuestion(channel, questionData);
        break;
      case "true_false":
        sendTrueFalseQuestion(channel, questionData);
        break;
      case "short_answer":
        sendShortAnswerQuestion(channel, questionData);
        break;
    }
  } else {
    // After the last question, display the leaderboard
    displayLeaderboard(channel);
    endQuiz(channel);
  }
}

function sendMultipleChoiceQuestion(channel, questionData) {
  channel.send(questionData.question);
  
  const { choices } = questionData;
  const reactions = ["🇦", "🇧", "🇨", "🇩"];

  channel
    .send(
      choices.map((choice, index) => `${reactions[index]} ${choice}`).join("\n")
    )
    .then((questionMessage) => {
      reactions.forEach((reaction) => questionMessage.react(reaction));

      setTimeout(() => {
        showCorrectAnswer(channel, questionData);
      }, 10000);
    });
}

function sendTrueFalseQuestion(channel, questionData) {
  channel
    .send(`${questionData.question}\nReact with ✅ for true or ❌ for false.`)
    .then((questionMessage) => {
      questionMessage.react("✅");
      questionMessage.react("❌");

      setTimeout(() => {
        showCorrectAnswer(channel, questionData);
      }, 10000);
    });
}

function sendShortAnswerQuestion(channel, questionData) {
  channel.send(`${questionData.question}\nType your answer in the chat.`);

  setTimeout(() => {
    showCorrectAnswer(channel, questionData);
  }, 10000);
}

function showCorrectAnswer(channel, questionData) {
  const correctAnswer = getCorrectAnswer(questionData);

  // Display correct answer based on question type
  switch (questionData.type) {
    case "multiple_choice":
      channel.send(`The correct answer is: ${correctAnswer}`);
      break;
    case "true_false":
      channel.send(
        `The correct answer is: ${correctAnswer ? "true" : "false"}`
      );
      break;
    case "short_answer":
      channel.send(`The correct answer is: ${correctAnswer}`);
      break;
  }

  if (questionData.type === "short_answer") {
    evaluateShortAnswerResponses(channel, questionData, correctAnswer);
  } else {
    updateScores(channel, questionData, correctAnswer);
  }

  currentQuestionIndex++;
  sendQuestion(channel);
}

function getCorrectAnswer(questionData) {
  return questionData.type === "short_answer"
    ? questionData.acceptableAnswers[0]
    : questionData.correctAnswer;
}

function evaluateShortAnswerResponses(channel, questionData, correctAnswer) {
  const responses = participants[channel.guild.id];

  if (!responses) {
    console.error("Error: 'responses' is undefined.");
    return;
  }

  const participantsArray = Object.keys(responses);

  participantsArray.forEach((participant) => {
    const response = responses[participant][currentQuestionIndex - 1];
    const isCorrect =
      response && response.toLowerCase() === correctAnswer.toLowerCase();
    updateParticipantScore(channel.guild.id, participant, isCorrect);
  });

  updateScores(channel, questionData, correctAnswer);
}

function updateScores(channel, questionData, correctAnswer) {
  const responses = participants[channel.guild.id];

  if (!responses) {
    console.error("Error: 'responses' is undefined.");
    return;
  }

  const participantsArray = Object.keys(responses);

  participantsArray.forEach((participant) => {
    const response = responses[participant][currentQuestionIndex - 1];
    const isCorrect = response === correctAnswer;

    updateParticipantScore(channel.guild.id, participant, isCorrect);
  });

  displayLeaderboard(channel);
}

function updateParticipantScore(guildId, participant, isCorrect) {
  if (!participants[guildId]) participants[guildId] = {};

  if (!participants[guildId][participant]) {
    participants[guildId][participant] = 0;
  }

  if (isCorrect) {
    participants[guildId][participant]++;
  }
}

function displayLeaderboard(channel) {
  const scores = participants[channel.guild.id];

  if (!scores) {
    console.error("Error: 'scores' is undefined.");
    return;
  }

  const participantsArray = Object.keys(scores);

  if (participantsArray.length === 0) {
    channel.send("No participants. The leaderboard is empty.");
    return;
  }

  const leaderboard = participantsArray
    .sort((a, b) => scores[b] - scores[a])
    .map(
      (participant, index) =>
        `${index + 1}. ${participant}: ${scores[participant]} points`
    )
    .join("\n");

  // Send the leaderboard to the channel
  channel.send(`**Leaderboard**\n${leaderboard}`);
}

function handleQuizResponse(message) {
  const participant = message.author.username;
  const response = message.content;

  if (!participants[message.guild.id]) participants[message.guild.id] = {};
  if (!participants[message.guild.id][participant])
    participants[message.guild.id][participant] = [];

  participants[message.guild.id][participant].push(response);
}

function endQuiz(channel) {
  quizRunning = false;
  currentQuestionIndex = 0;
  participants = {};

  channel.send("Quiz ended. Use !startquiz to start a new quiz.");
}

client.login(TOKEN);
