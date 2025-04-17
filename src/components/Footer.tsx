import React from 'react';
import { FaDiscord, FaXTwitter } from "react-icons/fa6";
import { TbBrandTelegram } from "react-icons/tb";
import { SiMagic } from "react-icons/si";

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-white/10 bg-gray-900/30 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Logo & Description */}
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Clash of Critters
              </span>
            </div>
            <p className="text-sm text-gray-400 text-center md:text-left">
              The First Ever NFT Betting Arena on Monad
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col items-center md:items-start">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Quick Links</h3>
            <div className="flex flex-col gap-2">
              <a 
                href="https://magiceden.io/collections/monad-testnet/0xd25308c3f5619f7f4fc82cbfa39a38ecd6ec057a?activeTab=items"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
              >
                <SiMagic className="w-4 h-4" />
                Trade on Magic Eden
              </a>
              <a 
                href="Coming Soon!" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Documentation
              </a>
            </div>
          </div>

          {/* Community */}
          <div className="flex flex-col items-center md:items-start">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Join the Community</h3>
            <div className="flex items-center gap-4">
              <a
                href="https://discord.gg/y8n7ySKfNd"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Discord"
              >
                <FaDiscord className="w-6 h-6" />
              </a>
              <a
                href="https://x.com/CritterClashFi"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Twitter"
              >
                <FaXTwitter className="w-6 h-6" />
              </a>
              <a
                href="https://t.me/clashofcritters"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Telegram"
              >
                <TbBrandTelegram className="w-6 h-6" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Credits */}
        <div className="mt-8 pt-4 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            Built on Monad • Powered by Pyth Network
          </p>
          <p className="text-xs text-gray-500">
            © 2025 Clash of Critters. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}; 