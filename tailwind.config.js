/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cave: { 950:'#06060f', 900:'#0a0a14', 800:'#10101e', 700:'#181830', 600:'#222244' },
        gold: { 300:'#ffe066', 400:'#ffd700', 500:'#e6c200', 600:'#ccaa00' },
        gem: {
          ruby:'#e74c3c', sapphire:'#3b82f6', emerald:'#10b981',
          amethyst:'#a855f7', diamond:'#67e8f9', topaz:'#f97316', pink:'#ec4899',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['"Nunito"', 'sans-serif'],
      },
      animation: {
        'float':'float 3s ease-in-out infinite',
        'shimmer':'shimmer 2s linear infinite',
        'shake':'shake 0.1s ease-in-out',
        'thought':'thought 4.5s ease-out forwards',
        'tap-up':'tapUp 0.7s ease-out forwards',
        'gem-burst':'gemBurst 0.5s ease-out forwards',
      },
      keyframes: {
        float:{'0%,100%':{transform:'translateY(0)'},'50%':{transform:'translateY(-8px)'}},
        shimmer:{'0%':{backgroundPosition:'-200% 0'},'100%':{backgroundPosition:'200% 0'}},
        shake:{'0%,100%':{transform:'rotate(0) scale(1)'},'25%':{transform:'rotate(-8deg) scale(0.92)'},'75%':{transform:'rotate(5deg) scale(0.95)'}},
        thought:{'0%':{opacity:0,transform:'translateY(10px) scale(0.85)'},'12%':{opacity:1,transform:'translateY(-10px) scale(1)'},'75%':{opacity:1,transform:'translateY(-60px)'},'100%':{opacity:0,transform:'translateY(-100px) scale(0.95)'}},
        tapUp:{'0%':{opacity:1,transform:'translateY(0) scale(1)'},'100%':{opacity:0,transform:'translateY(-50px) scale(1.2)'}},
        gemBurst:{'0%':{opacity:1,transform:'scale(0.5)'},'100%':{opacity:0,transform:'scale(1.8) translateY(-20px)'}},
      },
    },
  },
  plugins: [],
}
