
import React, { useState } from 'react';
import MockBrowser from './components/MockBrowser';
import ExtensionSidebar from './components/ExtensionSidebar';

// URLs extracted from the Google Search Result HTML
const DETECTED_URLS = [
  "https://www.petmd.com/cat/behavior/why-do-cats-purr",
  "https://en.wikipedia.org/wiki/Purr",
  "https://meowtel.com/blog/post/why-do-cats-purr-here-s-what-it-means",
  "https://www.vetradar.com/blog/why-do-cats-purr",
  "https://www.reddit.com/r/explainlikeimfive/comments/1pnvg16/eli5_why_do_cats_purr_and_why_do_they_do_it_even/",
  "https://www.cats.org.uk/cats-blog/why-does-my-cat-purr",
  "https://cvets.net/reasons-why-cats-purr/",
  "https://www.whiskas.co.uk/blog/behaviour/why-do-cats-purr",
  "https://www.scientificamerican.com/article/why-do-cats-purr/",
  "https://www.loc.gov/everyday-mysteries/zoology/item/why-and-how-do-cats-purr/"
];

const App: React.FC = () => {
  const [selectedText, setSelectedText] = useState('');

  return (
    <div className="flex h-screen bg-gray-900 justify-center items-center p-4 md:p-8">
      {/* Simulation Container */}
      <div className="flex w-full max-w-[1400px] h-[800px] bg-white rounded-xl shadow-2xl overflow-hidden ring-4 ring-gray-800">
        
        {/* Left: The "Web Page" */}
        <MockBrowser onTextSelect={setSelectedText} />

        {/* Right: The "Extension Sidebar" */}
        {/* In a real Chrome extension, this would be the side panel or popup */}
        <ExtensionSidebar 
          selectedText={selectedText} 
          knownUrls={DETECTED_URLS}
        />
        
      </div>
      
      {/* Informational overlay for the user of this simulator */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-full text-sm backdrop-blur-md shadow-lg pointer-events-none z-50 text-center">
        Highlight text in the AI output (left) to verify it with Gemini.<br/>
        <span className="text-xs opacity-75">Using simulated Google Search HTML</span>
      </div>
    </div>
  );
};

export default App;
