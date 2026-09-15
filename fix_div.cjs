const fs = require('fs');
let content = fs.readFileSync('src/components/GenerationCard.tsx', 'utf-8');

const target = `      </motion.div>
    </div>
  );
});`;

const replace = `      </motion.div>
    </motion.div>
  );
});`;

content = content.replace(target, replace);
fs.writeFileSync('src/components/GenerationCard.tsx', content);
