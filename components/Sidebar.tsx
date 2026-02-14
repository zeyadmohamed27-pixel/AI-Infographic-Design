
import React from 'react';
import { DesignStyle, AspectRatio, GenerationConfig } from '../types';

interface SidebarProps {
  config: GenerationConfig;
  setConfig: React.Dispatch<React.SetStateAction<GenerationConfig>>;
}

export const Sidebar: React.FC<SidebarProps> = ({ config, setConfig }) => {
  const styles = Object.values(DesignStyle);
  const ratios = Object.values(AspectRatio);
  const variationOptions = [1, 2, 3, 4];

  return (
    <div className="w-full lg:w-80 bg-slate-900/50 backdrop-blur-xl border-l border-slate-800 p-6 flex flex-col gap-8">
      <div>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">نمط التصميم</h3>
        <div className="grid grid-cols-2 gap-2">
          {styles.map((style) => (
            <button
              key={style}
              onClick={() => setConfig({ ...config, style })}
              className={`px-3 py-2 rounded-lg text-sm transition-all border ${
                config.style === style
                  ? "bg-blue-600/20 border-blue-500 text-blue-400"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">أبعاد الصورة</h3>
        <div className="grid grid-cols-3 gap-2">
          {ratios.map((ratio) => (
            <button
              key={ratio}
              onClick={() => setConfig({ ...config, ratio })}
              className={`px-2 py-3 rounded-lg text-xs transition-all border flex flex-col items-center gap-1 ${
                config.ratio === ratio
                  ? "bg-blue-600/20 border-blue-500 text-blue-400"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
              }`}
            >
              <div className={`w-4 h-4 border-2 rounded-sm border-current ${
                ratio === AspectRatio.LANDSCAPE ? 'w-6' : 
                ratio === AspectRatio.PORTRAIT ? 'h-6' : 
                ratio === AspectRatio.WIDE ? 'w-5' : 
                ratio === AspectRatio.TALL ? 'h-5' : 'w-4 h-4'
              }`} />
              {ratio}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">عدد النسخ</h3>
        <div className="flex gap-2">
          {variationOptions.map((v) => (
            <button
              key={v}
              onClick={() => setConfig({ ...config, variations: v })}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all border ${
                config.variations === v
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800 space-y-6">
        <label className="flex items-center justify-between cursor-pointer group">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-300 group-hover:text-blue-400 transition-colors">خرائط جوجل</span>
            <span className="text-[10px] text-slate-500">سياق جغرافي حقيقي</span>
          </div>
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={config.useMaps}
              onChange={(e) => setConfig({ ...config, useMaps: e.target.checked })}
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </div>
        </label>

        <label className="flex items-center justify-between cursor-pointer group">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-300 group-hover:text-blue-400 transition-colors">جودة فائقة (Pro)</span>
            <span className="text-[10px] text-slate-500">يتطلب Gemini 3 Pro</span>
          </div>
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={config.highQuality}
              onChange={(e) => setConfig({ ...config, highQuality: e.target.checked })}
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </div>
        </label>
      </div>
    </div>
  );
};
