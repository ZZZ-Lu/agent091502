import re

with open('server.ts', 'r') as f:
    code = f.read()

target_str = """              const body = await parseResponse.json();
              let content = body.choices[0].message.content || '{}';
              content = content.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
              const parsed = JSON.parse(content);"""

new_str = """              const body = await parseResponse.json();
              let content = body.choices[0].message.content || '{}';
              content = content.trim();
              if (content.startsWith('```json')) content = content.slice(7);
              else if (content.startsWith('```')) content = content.slice(3);
              if (content.endsWith('```')) content = content.slice(0, -3);
              content = content.trim();
              const parsed = JSON.parse(content);"""

code = code.replace(target_str, new_str)

with open('server.ts', 'w') as f:
    f.write(code)
