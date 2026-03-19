# **PRD: CSV Import to Interactive Flashcard Activity**

## **1\. Context & Goal**

I am building a custom Learning Management System (LMS). I need to create a new interactive activity module: a "Flashcard Player."

The goal is to allow educators/users to upload a .csv file containing questions and answers, parse that file in the browser, and instantly generate an interactive, flippable flashcard deck similar to Quizlet or NotebookLM.

Please write the frontend code (HTML/CSS/JS or framework-specific components) to implement this feature based on the requirements below.

## **2\. User Flow**

1. **State 1: Upload UI** \- User sees a drag-and-drop zone or "Choose File" button specifically for .csv files.  
2. **State 2: Processing** \- The app parses the CSV locally in the browser.  
3. **State 3: Flashcard Player (Active)** \- The upload UI disappears, and the interactive flashcard player renders with the parsed data.  
4. **State 4: Completion** \- When the user reaches the last card, a summary screen appears with a "Restart" or "Upload New Deck" option.

## **3\. Technical Requirements**

### **3.1 Data Ingestion & Parsing**

* **Input:** A standard .csv file.  
* **Structure:** Assume Column A is the "Front" (Question) and Column B is the "Back" (Answer).  
* **Headers:** The parser should handle files with or without headers (e.g., skip row 1 if it contains "Front, Back" or "Question, Answer").  
* **Library:** Use a robust client-side parser like PapaParse (or native JavaScript if you prefer, but it must handle commas inside quotes correctly).

### **3.2 Target Data Schema (Post-Parsing)**

Once parsed, the data should be mapped to an array of objects in the state:

\[  
  { "id": 1, "front": "Question text here", "back": "Answer text here" },  
  { "id": 2, "front": "Next question", "back": "Next answer" }  
\]

### **3.3 State Management requirements**

The component needs to track:

* flashcards: Array of parsed card objects.  
* currentIndex: Integer tracking the currently displayed card (default: 0).  
* isFlipped: Boolean tracking if the current card is showing the front or back (default: false). Reset this to false every time currentIndex changes.  
* knownCount / unknownCount: (Optional/Bonus) Integers to track user self-assessment.

## **4\. UI & UX Specifications**

### **4.1 The Flashcard Component**

* **Dimensions:** Fixed height/width (e.g., max-width: 600px, height: 400px) to keep text centered, fully responsive for mobile screens.  
* **Animation:** Must use CSS 3D transforms (preserve-3d, rotateY, backface-visibility: hidden) for a smooth, physical-feeling flip animation. The transition duration should be \~0.4s to 0.6s.  
* **Typography:** Clean, highly legible sans-serif font. Text should automatically center both vertically and horizontally.  
* **Click Target:** Clicking *anywhere* on the card should trigger the flip.

### **4.2 Player Controls**

Below the flashcard, include the following controls:

* **Previous Button:** Navigates to currentIndex \- 1\. Disabled if on the first card.  
* **Next Button:** Navigates to currentIndex \+ 1\.  
* **Progress Indicator:** Text displaying current position (e.g., "Card 3 of 20").  
* **Self-Assessment (Like NotebookLM):** Two buttons below the card: a red "X" (Needs Review) and a green "Check" (Got it). Clicking these should record the score and auto-advance to the next card.

## **5\. Edge Cases & Error Handling to Implement**

* **Invalid File Type:** If the user uploads a .txt or .pdf, show an error state: "Please upload a valid .csv file."  
* **Malformed CSV:** If the CSV has only 1 column or empty rows, filter out the empty rows and show a warning if no valid cards can be generated.  
* **Long Text:** If the front or back contains a paragraph of text, the card should either apply a scrollbar (overflow-y: auto) inside the card OR dynamically scale the font size down. Do not let the card container break its layout.

## **6\. Implementation Instructions for the Agent**

1. Please ask me what my frontend tech stack is (React, Vue, Angular, or Vanilla JS/HTML) before writing the code, so you can tailor the implementation.  
2. Provide the complete code for the file parser, state logic, and the UI components.  
3. Provide all necessary CSS (or Tailwind classes) for the 3D flip animation and responsive layout.