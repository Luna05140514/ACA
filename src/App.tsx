/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Eye, Ruler, Activity, Save, RotateCcw, Info } from 'lucide-react';

interface PrismData {
  blur: string;
  break: string;
  recovery: string;
}

interface VisionData {
  distance: {
    phoriaValue: string;
    phoriaType: 'exo' | 'eso' | 'ortho';
    bi: PrismData;
    bo: PrismData;
  };
  near: {
    phoriaValue: string;
    phoriaType: 'exo' | 'eso' | 'ortho';
    phoriaPlus1Value: string;
    phoriaPlus1Type: 'exo' | 'eso' | 'ortho';
    bi: PrismData;
    bo: PrismData;
    nra: string;
    pra: string;
  };
}

const initialPrismData = (): PrismData => ({
  blur: '',
  break: '',
  recovery: '',
});

const initialData: VisionData = {
  distance: {
    phoriaValue: '',
    phoriaType: 'ortho',
    bi: initialPrismData(),
    bo: initialPrismData(),
  },
  near: {
    phoriaValue: '',
    phoriaType: 'ortho',
    phoriaPlus1Value: '',
    phoriaPlus1Type: 'ortho',
    bi: initialPrismData(),
    bo: initialPrismData(),
    nra: '',
    pra: '',
  },
};

// Analysis Logic
const parseValue = (val: string) => {
  const num = parseFloat(val.replace(/[^\d.-]/g, ''));
  return isNaN(num) ? 0 : num;
};

const calculateAnalysis = (data: VisionData, section: 'distance' | 'near') => {
  const phoriaVal = parseValue(data[section].phoriaValue);
  const phoria = {
    value: phoriaVal,
    type: data[section].phoriaType
  };
  const bi = {
    blur: parseValue(data[section].bi.blur),
    break: parseValue(data[section].bi.break),
    recovery: parseValue(data[section].bi.recovery),
  };
  const bo = {
    blur: parseValue(data[section].bo.blur),
    break: parseValue(data[section].bo.break),
    recovery: parseValue(data[section].bo.recovery),
  };

  // Sheard's Criterion: Reserve >= 2 * Demand
  // Demand = Phoria, Reserve = Opposing range (Exo -> BO, Eso -> BI)
  let sheardResult = { met: true, message: '符合標準', prism: 0 };
  if (phoria.type !== 'ortho') {
    const demand = phoria.value;
    const reserve = phoria.type === 'exo' ? (bo.blur || bo.break) : (bi.blur || bi.break);
    if (reserve < 2 * demand) {
      sheardResult.met = false;
      const needed = (2 * demand - reserve) / 3;
      sheardResult.prism = Math.max(0, parseFloat(needed.toFixed(1)));
      sheardResult.message = `不符合 (需 ${sheardResult.prism}Δ ${phoria.type === 'exo' ? 'BO' : 'BI'})`;
    }
  }

  // 1:1 Rule (Usually for Esophoria): Recovery >= Demand
  let oneToOneResult = { met: true, message: '符合標準', prism: 0 };
  if (phoria.type === 'eso') {
    const demand = phoria.value;
    const recovery = bi.recovery;
    if (recovery < demand) {
      oneToOneResult.met = false;
      const needed = (demand - recovery) / 2;
      oneToOneResult.prism = Math.max(0, parseFloat(needed.toFixed(1)));
      oneToOneResult.message = `不符合 (需 ${oneToOneResult.prism}Δ BI)`;
    }
  } else {
    oneToOneResult.message = '不適用 (非內斜)';
  }

  // Percival's Criterion: Lesser Range >= 1/2 Greater Range (or G <= 2L)
  // Based on break values
  const G = Math.max(bi.break, bo.break);
  const L = Math.min(bi.break, bo.break);
  let percivalResult = { met: true, message: '符合標準', prism: 0 };
  if (G > 2 * L) {
    percivalResult.met = false;
    const needed = (G - 2 * L) / 3;
    percivalResult.prism = Math.max(0, parseFloat(needed.toFixed(1)));
    percivalResult.message = `不符合 (需 ${percivalResult.prism}Δ 稜鏡)`;
  }

  return { sheard: sheardResult, oneToOne: oneToOneResult, percival: percivalResult };
};

const AnalysisCard = ({ data, section }: { data: VisionData, section: 'distance' | 'near' }) => {
  const results = calculateAnalysis(data, section);
  const hasData = data[section].phoriaValue || data[section].bi.break || data[section].bo.break;

  if (!hasData) return null;

  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
      <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
        <Activity size={16} className="text-blue-600" />
        自動分析結果 ({section === 'distance' ? '遠' : '近'})
      </h4>
      <div className="grid grid-cols-1 gap-3">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500 font-medium">Sheard's 準則</span>
          <span className={`font-bold ${results.sheard.met ? 'text-green-600' : 'text-red-600'}`}>
            {results.sheard.message}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500 font-medium">1:1 法則</span>
          <span className={`font-bold ${results.oneToOne.met ? 'text-green-600' : 'text-gray-400'}`}>
            {results.oneToOne.message}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500 font-medium">Percival's 準則</span>
          <span className={`font-bold ${results.percival.met ? 'text-green-600' : 'text-red-600'}`}>
            {results.percival.message}
          </span>
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ icon: Icon, title, subtitle, children }: { icon: any, title: string, subtitle: string, children?: React.ReactNode }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-gray-200 pb-4">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
        <Icon size={24} />
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
    </div>
    {children}
  </div>
);

const PrismInputGroup = ({ 
  label, 
  section, 
  field, 
  values,
  norms,
  onInputChange,
  onKeyDown
}: { 
  label: string, 
  section: 'distance' | 'near', 
  field: 'bi' | 'bo', 
  values: PrismData,
  norms: { blur: string, break: string, recovery: string },
  onInputChange: (section: 'distance' | 'near', field: string, value: string, subField?: keyof PrismData) => void,
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, currentId: string) => void
}) => (
  <div className="space-y-3">
    <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wider">
      {label} (水平稜鏡 Δ)
    </label>
    <div className="grid grid-cols-3 gap-3">
      {(['blur', 'break', 'recovery'] as const).map((sub) => (
        <div key={sub} className="space-y-1">
          <span className="text-[10px] text-gray-400 uppercase font-bold">
            {sub === 'blur' ? '模糊' : sub === 'break' ? '破裂' : '恢復'}
          </span>
          <input
            id={`${section === 'distance' ? 'dist' : 'near'}-${field}-${sub}`}
            type="text"
            value={values[sub]}
            onChange={(e) => onInputChange(section, field, e.target.value, sub)}
            onKeyDown={(e) => onKeyDown(e, `${section === 'distance' ? 'dist' : 'near'}-${field}-${sub}`)}
            placeholder={norms[sub]}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-mono placeholder:text-gray-300"
          />
        </div>
      ))}
    </div>
  </div>
);

export default function App() {
  const [data, setData] = useState<VisionData>(initialData);

  const handleInputChange = (
    section: 'distance' | 'near',
    field: string,
    value: string,
    subField?: keyof PrismData
  ) => {
    setData((prev) => {
      const newData = { ...prev };
      if (subField && (field === 'bi' || field === 'bo')) {
        newData[section][field] = {
          ...newData[section][field],
          [subField]: value,
        };
      } else {
        // @ts-ignore - dynamic key access
        newData[section][field] = value;

        // Auto-switch phoria type based on value
        if (field === 'phoriaValue' || field === 'phoriaPlus1Value') {
          const num = parseFloat(value.replace(/[^\d.-]/g, ''));
          const typeField = field === 'phoriaValue' ? 'phoriaType' : 'phoriaPlus1Type';
          if (num === 0) {
            // @ts-ignore
            newData[section][typeField] = 'ortho';
          } else if (newData[section][typeField] === 'ortho' && value !== '') {
            // @ts-ignore
            newData[section][typeField] = 'exo'; // Default to BI if non-zero
          }
        }
      }
      return newData;
    });
  };

  const handleReset = () => {
    if (window.confirm('確定要清除所有輸入的數據嗎？')) {
      setData(initialData);
    }
  };

  const handleSave = () => {
    console.log('Saving data:', data);
    alert('數據已儲存（模擬）');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const inputIds = [
        'dist-phoria',
        'dist-bi-blur', 'dist-bi-break', 'dist-bi-recovery',
        'dist-bo-blur', 'dist-bo-break', 'dist-bo-recovery',
        'near-phoria',
        'near-phoria-plus1',
        'near-bi-blur', 'near-bi-break', 'near-bi-recovery',
        'near-bo-blur', 'near-bo-break', 'near-bo-recovery',
        'near-nra',
        'near-pra'
      ];
      const currentIndex = inputIds.indexOf(currentId);
      if (currentIndex !== -1 && currentIndex < inputIds.length - 1) {
        const nextInput = document.getElementById(inputIds[currentIndex + 1]);
        if (nextInput) {
          nextInput.focus();
          // @ts-ignore
          nextInput.select();
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans relative">
      <div className="max-w-5xl mx-auto relative">
        {/* Top Right Reset Button */}
        <div className="absolute top-0 right-0">
          <button
            onClick={handleReset}
            title="清除所有數據"
            className="p-3 bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 rounded-xl transition-all shadow-sm group"
          >
            <RotateCcw size={20} className="group-hover:rotate-[-45deg] transition-transform" />
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
            雙眼視覺分析
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Distance Section (6m) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <SectionHeader 
              icon={Ruler} 
              title="遠方數據" 
              subtitle="6 公尺" 
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  遠方斜位
                </span>
                <div className="flex gap-2">
                  <div className="relative w-24">
                    <input
                      id="dist-phoria"
                      type="text"
                      value={data.distance.phoriaValue}
                      onChange={(e) => handleInputChange('distance', 'phoriaValue', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 'dist-phoria')}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono text-sm placeholder:text-gray-300"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">Δ</span>
                  </div>
                  <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                    {(['exo', 'eso'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => handleInputChange('distance', 'phoriaType', type)}
                        disabled={data.distance.phoriaValue === '0'}
                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                          data.distance.phoriaType === type && data.distance.phoriaValue !== '0'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : data.distance.phoriaValue === '0'
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {type === 'exo' ? 'BI' : 'BO'}
                      </button>
                    ))}
                    {data.distance.phoriaValue === '0' && (
                      <div className="px-2 py-1 text-[10px] font-bold text-blue-600 bg-white rounded-md shadow-sm">
                        正
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SectionHeader>
            
            <div className="space-y-8">
              {/* Fusion Range */}
              <div className="space-y-6 pt-4 border-t border-gray-100">
                <PrismInputGroup 
                  label="Base In (BI)" 
                  section="distance" 
                  field="bi" 
                  values={data.distance.bi}
                  norms={{ blur: 'x', break: '7', recovery: '4' }}
                  onInputChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                />
                <PrismInputGroup 
                  label="Base Out (BO)" 
                  section="distance" 
                  field="bo" 
                  values={data.distance.bo}
                  norms={{ blur: '9', break: '19', recovery: '10' }}
                  onInputChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                />
              </div>

              <AnalysisCard data={data} section="distance" />
            </div>
          </div>

          {/* Near Section (40cm) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <SectionHeader 
              icon={Activity} 
              title="近方數據" 
              subtitle="40 公分" 
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap w-20">
                    近方斜位
                  </span>
                  <div className="flex gap-2">
                    <div className="relative w-24">
                      <input
                        id="near-phoria"
                        type="text"
                        value={data.near.phoriaValue}
                        onChange={(e) => handleInputChange('near', 'phoriaValue', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, 'near-phoria')}
                        placeholder="0"
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono text-sm placeholder:text-gray-300"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">Δ</span>
                    </div>
                    <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                      {(['exo', 'eso'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => handleInputChange('near', 'phoriaType', type)}
                          disabled={data.near.phoriaValue === '0'}
                          className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                            data.near.phoriaType === type && data.near.phoriaValue !== '0'
                              ? 'bg-white text-blue-600 shadow-sm'
                              : data.near.phoriaValue === '0'
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          {type === 'exo' ? 'BI' : 'BO'}
                        </button>
                      ))}
                      {data.near.phoriaValue === '0' && (
                        <div className="px-2 py-1 text-[10px] font-bold text-blue-600 bg-white rounded-md shadow-sm">
                          正
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap w-20">
                    +1.00 斜位
                  </span>
                  <div className="flex gap-2">
                    <div className="relative w-24">
                      <input
                        id="near-phoria-plus1"
                        type="text"
                        value={data.near.phoriaPlus1Value}
                        onChange={(e) => handleInputChange('near', 'phoriaPlus1Value', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, 'near-phoria-plus1')}
                        placeholder="0"
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono text-sm placeholder:text-gray-300"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">Δ</span>
                    </div>
                    <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                      {(['exo', 'eso'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => handleInputChange('near', 'phoriaPlus1Type', type)}
                          disabled={data.near.phoriaPlus1Value === '0'}
                          className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                            data.near.phoriaPlus1Type === type && data.near.phoriaPlus1Value !== '0'
                              ? 'bg-white text-blue-600 shadow-sm'
                              : data.near.phoriaPlus1Value === '0'
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          {type === 'exo' ? 'BI' : 'BO'}
                        </button>
                      ))}
                      {data.near.phoriaPlus1Value === '0' && (
                        <div className="px-2 py-1 text-[10px] font-bold text-blue-600 bg-white rounded-md shadow-sm">
                          正
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </SectionHeader>
            
            <div className="space-y-8">
              {/* Fusion Range */}
              <div className="space-y-6 pt-4 border-t border-gray-100">
                <PrismInputGroup 
                  label="Base In (BI)" 
                  section="near" 
                  field="bi" 
                  values={data.near.bi}
                  norms={{ blur: '13', break: '21', recovery: '13' }}
                  onInputChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                />
                <PrismInputGroup 
                  label="Base Out (BO)" 
                  section="near" 
                  field="bo" 
                  values={data.near.bo}
                  norms={{ blur: '17', break: '21', recovery: '11' }}
                  onInputChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                />
              </div>

              <AnalysisCard data={data} section="near" />

              {/* Accommodation */}
              <div className="pt-6 border-t border-gray-100">
                <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  調節功能 (Accommodation)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-gray-500 font-medium">NRA (-)</span>
                    <div className="relative">
                      <input
                        id="near-nra"
                        type="text"
                        value={data.near.nra}
                        onChange={(e) => handleInputChange('near', 'nra', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, 'near-nra')}
                        placeholder="+2.00"
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-300"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">D</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-gray-500 font-medium">PRA (+)</span>
                    <div className="relative">
                      <input
                        id="near-pra"
                        type="text"
                        value={data.near.pra}
                        onChange={(e) => handleInputChange('near', 'pra', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, 'near-pra')}
                        placeholder="-2.37"
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-300"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">D</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={handleSave}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-12 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-200"
          >
            <Save size={20} />
            儲存分析結果
          </button>
        </div>

        {/* Footer Info */}
        <div className="mt-12 flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-800 text-sm">
          <Info className="shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-bold mb-1">使用說明：</p>
            <ul className="list-disc list-inside space-y-1 opacity-90">
              <li>所有數值欄位均可手動輸入，支援正負號。</li>
              <li>融像範圍請依序輸入「模糊 / 破裂 / 恢復」數值。</li>
              <li>調節功能單位為屈光度 (D)，稜鏡單位為稜鏡度 (Δ)。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
