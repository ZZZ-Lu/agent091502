const fs = require('fs');
const file = 'src/components/GenerationCard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Find the start of the video block
const videoStart = content.indexOf('<motion.video');
if (videoStart === -1) throw new Error("Couldn't find <motion.video");

// We need to wrap just the <motion.video> and the Progress Bar
// Actually, it's easier to just use an array of replacements.

content = content.replace(
  '<motion.video',
  '{(isHovered || isPlaying) && <motion.video'
);

// Now find where motion.video ends:
// It ends with '}} />'
const videoEnd = content.indexOf('/>', content.indexOf('onPause={(e) => {'));
if (videoEnd === -1) throw new Error("Couldn't find end of motion.video");

// We just append } after the />
content = content.slice(0, videoEnd + 2) + '}' + content.slice(videoEnd + 2);

// Now for the Progress Bar Controller Overlay
const progressStart = content.indexOf('{/* Progress Bar Controller Overlay */}');
if (progressStart === -1) throw new Error("Couldn't find Progress Bar");

content = content.slice(0, progressStart) + '{(isHovered || isPlaying) && (' + content.slice(progressStart);

// Now we need to find the end of the progress bar div. It ends right before `</div>` and `</div>` and `) : (`
const canvasStart = content.indexOf(') : (', progressStart);
// Let's find the closing tag for the progress bar overlay.
// We can just add the closing parenthesis before `</div>` that closes the `group/video`
// group/video div closes right before `) : (` but there are two divs closing.
// Actually let's use a regex or string replacement on the exact ending.

fs.writeFileSync('temp.txt', content);
