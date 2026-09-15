const arguments_ = { direction: 'top' };
let delta = 480;
if (arguments_.direction === 'top') delta = -999999;
else if (arguments_.direction === 'bottom') delta = 999999;
else if (arguments_.direction === 'up') delta = -480;
else if (arguments_.direction === 'down') delta = 480;
else {
  const requestedDelta = Number(arguments_.delta);
  if (Number.isFinite(requestedDelta) && requestedDelta !== 0) delta = requestedDelta;
}
console.log(delta);
