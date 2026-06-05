const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../frontend');

const newConfig = `        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        base: '#EBE1D7',
                        surface: '#FFFFFF',
                        secondary: '#F5F2EF',
                        primary: '#2D241E',
                        muted: '#7A6B61',
                        accent: '#5C4332',
                        'accent-hover': '#423023'
                    },
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                        serif: ['Playfair Display', 'serif'],
                    }
                }
            }
        }`;

const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

for (let file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace config
    content = content.replace(/tailwind\.config = \{[\s\S]*?\}\n        \}/, newConfig);
    
    // Replace body
    content = content.replace(/bg-dark text-white/g, 'bg-base text-primary');
    
    // Replace text-gray-400 with text-muted
    content = content.replace(/text-gray-400/g, 'text-muted');
    content = content.replace(/text-gray-300/g, 'text-muted');
    content = content.replace(/text-gray-500/g, 'text-muted');
    
    // Replace bg-surface (which was #141414, but now surface is #FFFFFF which is fine for cards)
    // Wait, in previous dark mode, bg-surface was used for cards. In light mode, bg-surface is white, which is perfect for cards!
    
    // Replace border-gray-800 and border-gray-700
    content = content.replace(/border-gray-800/g, 'border-accent/10');
    content = content.replace(/border-gray-700/g, 'border-accent/20');
    
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
}
