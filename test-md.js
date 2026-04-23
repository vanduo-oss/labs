import { labsMarkdownToHtml } from './labs-md-to-html.js';
const input = "Probability is a measure of how likely an event is to occur.\\n\\n* **Basic Idea:** Probability tells us...\\n* **Range:** Probability ranges from 0 to 1.\\n* **Examples:**\\n  * **Coin Toss:** The probability of getting heads...\\n  * **Weather:** The probability of rain...";
console.log(labsMarkdownToHtml(input.replace(/\\n/g, '\n')));
