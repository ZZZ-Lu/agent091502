const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectScriptBible.tsx', 'utf8');

const target = `                              return previewDiff.map((part, index) => {
                                  const isChanged = part.added || part.removed;
                                  let props: any = { key: index };
                                  
                                  if (isChanged && !firstChangeFound) {
                                      firstChangeFound = true;
                                      props.id = 'diff-first-change';
                                  }
                                  
                                  if (part.added) {
                                      props.className = "bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-200";
                                  } else if (part.removed) {
                                      props.className = "bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300 line-through opacity-70";
                                  }
                                  return <span {...props}>{part.value}</span>;
                              });`;

const replacement = `                              return previewDiff.map((part, index) => {
                                  const isChanged = part.added || part.removed;
                                  let props: any = {};
                                  
                                  if (isChanged && !firstChangeFound) {
                                      firstChangeFound = true;
                                      props.id = 'diff-first-change';
                                  }
                                  
                                  if (part.added) {
                                      props.className = "bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-200";
                                  } else if (part.removed) {
                                      props.className = "bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300 line-through opacity-70";
                                  }
                                  return <span key={index} {...props}>{part.value}</span>;
                              });`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/ProjectScriptBible.tsx', code);
  console.log("Success: fixed react key spread");
} else {
  console.log("Failed to find target");
}
