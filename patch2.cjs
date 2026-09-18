const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `      {/* Real-time FPS Counter */}
      <FpsCounter hasActiveTask={!!agentTask} />
    </div>
  );
}`;

const replaceStr = `      <AnimatePresence>
        {showOverview && (
          <OverviewMinimap
            cards={cards}
            tx={tx}
            ty={ty}
            tScale={tScale}
            onClose={() => setShowOverview(false)}
          />
        )}
      </AnimatePresence>

      {/* Real-time FPS Counter */}
      <FpsCounter hasActiveTask={!!agentTask} />
    </div>
  );
}`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replaceStr);
    fs.writeFileSync('src/App.tsx', code);
} else {
    console.log("Could not find target string.");
}
