const fs = require('fs');
let cssContent = fs.readFileSync('src/index.css', 'utf-8');

if (!cssContent.includes('.theme-transitioning')) {
  cssContent += `

/* Global Theme Transition: Slow down color changes ONLY when explicitly toggling dark mode */
.theme-transitioning,
.theme-transitioning *,
.theme-transitioning *::before,
.theme-transitioning *::after {
  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, box-shadow !important;
  transition-duration: 600ms !important;
  transition-timing-function: ease-in-out !important;
}
`;
  fs.writeFileSync('src/index.css', cssContent);
}

let appContent = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace the direct setIsDarkMode toggle with a wrapper
const targetClick = `onClick={() => setIsDarkMode(!isDarkMode)}`;
const replaceClick = `onClick={() => {
            document.documentElement.classList.add('theme-transitioning');
            setIsDarkMode(!isDarkMode);
            setTimeout(() => {
              document.documentElement.classList.remove('theme-transitioning');
            }, 600);
          }}`;

appContent = appContent.replace(targetClick, replaceClick);

// Also change back the hardcoded canvas transition from 600ms to its previous generic transition so hover/regular states don't get messed up if any.
// Actually, canvas doesn't have hover, but to be clean, let's remove duration-[600ms] and duration-300 from it, relying on theme-transitioning.
appContent = appContent.replace(`className="w-screen h-screen overflow-hidden bg-[#e7e7e7] dark:bg-[#1c1c1e] relative select-none touch-none transition-colors duration-[600ms]"`, `className="w-screen h-screen overflow-hidden bg-[#e7e7e7] dark:bg-[#1c1c1e] relative select-none touch-none"`);

// Remove old duration-300 if it was there just in case
appContent = appContent.replace(`className="w-screen h-screen overflow-hidden bg-[#e7e7e7] dark:bg-[#1c1c1e] relative select-none touch-none transition-colors duration-300"`, `className="w-screen h-screen overflow-hidden bg-[#e7e7e7] dark:bg-[#1c1c1e] relative select-none touch-none"`);

fs.writeFileSync('src/App.tsx', appContent);
console.log("Updated global theme transition.");
