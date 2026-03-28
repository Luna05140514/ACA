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

const getInitialData = (): VisionData => ({
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
});

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

  // AC/A Ratio (Gradient Method) - Always calculate from near data if available
  let acaResult = null;
  let acaValue = 0;
  if (data.near.phoriaValue !== '' && data.near.phoriaPlus1Value !== '') {
    const p1 = parseValue(data.near.phoriaValue) * (data.near.phoriaType === 'eso' ? 1 : -1);
    const p2 = parseValue(data.near.phoriaPlus1Value) * (data.near.phoriaPlus1Type === 'eso' ? 1 : -1);
    acaValue = Math.abs(p1 - p2);
    if (section === 'near') {
      const formattedAca = acaValue % 1 === 0 ? acaValue.toString() : acaValue.toFixed(1);
      acaResult = {
        value: formattedAca,
        message: formattedAca,
        status: acaValue >= 3 && acaValue <= 5 ? '正常' : acaValue < 3 ? '偏低' : '偏高'
      };
    }
  }

  // Sheard's Criterion: Reserve >= 2 * Demand
  // Demand = Phoria, Reserve = Opposing range (Exo -> BO, Eso -> BI)
  let sheardResult = { met: true, message: '符合標準', prism: 0, applicable: phoria.type === 'exo' };
  if (phoria.type === 'exo') {
    const demand = phoria.value;
    const reserve = bo.blur || bo.break;
    if (reserve < 2 * demand) {
      sheardResult.met = false;
      const needed = (2 * demand - reserve) / 3;
      sheardResult.prism = Math.max(0, parseFloat(needed.toFixed(2)));
      sheardResult.message = `不符合 (需 ${sheardResult.prism}Δ BI)`;
    }
    if (acaValue > 0 && sheardResult.prism > 0) {
      const acaCorrection = (-sheardResult.prism / acaValue).toFixed(2);
      sheardResult.message += ` (加入 ${acaCorrection}D)`;
    }
  } else {
    sheardResult.message = '不適用 (非外斜)';
  }

  // 1:1 Rule (Usually for Esophoria): Recovery >= Demand
  let oneToOneResult = { met: true, message: '符合標準', prism: 0, applicable: phoria.type === 'eso' };
  if (phoria.type === 'eso') {
    const demand = phoria.value;
    const recovery = bi.recovery;
    if (recovery < demand) {
      oneToOneResult.met = false;
      const needed = (demand - recovery) / 2;
      oneToOneResult.prism = Math.max(0, parseFloat(needed.toFixed(2)));
      oneToOneResult.message = `不符合 (需 ${oneToOneResult.prism}Δ BO)`;
    }
    if (acaValue > 0 && oneToOneResult.prism > 0) {
      const acaCorrection = (oneToOneResult.prism / acaValue).toFixed(2);
      oneToOneResult.message += ` (加入 ${acaCorrection}D)`;
    }
  } else {
    oneToOneResult.message = '不適用 (非內斜)';
  }

  // Percival's Criterion: Lesser Range >= 1/2 Greater Range (or G <= 2L)
  // Use blur point if available, otherwise use break point
  const valBI = bi.blur > 0 ? bi.blur : bi.break;
  const valBO = bo.blur > 0 ? bo.blur : bo.break;
  const G = Math.max(valBI, valBO);
  const L = Math.min(valBI, valBO);
  const greaterType = valBI > valBO ? 'BI' : 'BO';
  let percivalResult = { met: true, message: '符合標準', prism: 0 };
  if (G > 2 * L) {
    percivalResult.met = false;
    const needed = (G - 2 * L) / 3;
    percivalResult.prism = Math.max(0, parseFloat(needed.toFixed(2)));
    percivalResult.message = `不符合 (需 ${percivalResult.prism}Δ ${greaterType})`;
  }

  return { sheard: sheardResult, oneToOne: oneToOneResult, percival: percivalResult, aca: acaResult };
};

const calculateDysfunctionType = (data: VisionData) => {
  const distRaw = parseValue(data.distance.phoriaValue);
  const nearRaw = parseValue(data.near.phoriaValue);
  const distType = data.distance.phoriaType;
  const nearType = data.near.phoriaType;
  
  // Signed values for difference calculation
  const distSigned = distRaw * (distType === 'eso' ? 1 : -1);
  const nearSigned = nearRaw * (nearType === 'eso' ? 1 : -1);
  
  // AC/A calculation (Gradient)
  let aca = 0;
  let hasAca = false;
  if (data.near.phoriaValue !== '' && data.near.phoriaPlus1Value !== '') {
    const p1 = parseValue(data.near.phoriaValue) * (data.near.phoriaType === 'eso' ? 1 : -1);
    const p2 = parseValue(data.near.phoriaPlus1Value) * (data.near.phoriaPlus1Type === 'eso' ? 1 : -1);
    aca = Math.abs(p1 - p2);
    hasAca = true;
  }

  const threshold = 3;

  // Standard Norms for Phoria
  // Distance: 1Δ Eso to 3Δ Exo
  const isDistNormal = (distType === 'eso' && distRaw <= 1) || (distType === 'exo' && distRaw <= 3);
  // Near: 0 to 6Δ Exo
  const isNearNormal = (nearType === 'eso' && nearRaw === 0) || (nearType === 'exo' && nearRaw <= 6);

  if (hasAca) {
    // CI: Near Exo, Near Value > Distance Value, Distance Normal, AC/A < 3
    if (nearType === 'exo' && nearRaw > distRaw && isDistNormal && aca < 3) {
      return { type: '內聚不足 (Convergence Insufficiency, CI)', desc: '近方外斜程度大於遠方，且遠方在標準值內，伴隨低 AC/A。' };
    }
    // CE: Near Eso, Near Value > Distance Value, Distance Normal, AC/A > 5
    if (nearType === 'eso' && nearRaw > distRaw && isDistNormal && aca > 5) {
      return { type: '內聚過度 (Convergence Excess, CE)', desc: '近方內斜程度大於遠方，且遠方在標準值內，伴隨高 AC/A。' };
    }
    // DI: Distance Eso, Distance Value > Near Value, Near Normal, AC/A < 3
    if (distType === 'eso' && distRaw > nearRaw && isNearNormal && aca < 3) {
      return { type: '開散不足 (Divergence Insufficiency, DI)', desc: '遠方內斜程度大於近方，且近方在標準值內，伴隨低 AC/A。' };
    }
    // DE: Distance Exo, Distance Value > Near Value, Near Normal, AC/A > 5
    if (distType === 'exo' && distRaw > nearRaw && isNearNormal && aca > 5) {
      return { type: '開散過度 (Divergence Excess, DE)', desc: '遠方外斜程度大於近方，且近方在標準值內，伴隨高 AC/A。' };
    }
  }

  // Basic types: Distance and Near are similar (within threshold)
  if (Math.abs(nearSigned - distSigned) <= threshold) {
    if (distType === 'eso' && nearType === 'eso') {
      return { type: '基本型內斜 (Basic Esophoria)', desc: '遠近方的內斜程度接近，雙眼視覺狀態相對穩定。' };
    }
    if (distType === 'exo' && nearType === 'exo') {
      return { type: '基本型外斜 (Basic Exophoria)', desc: '遠近方的外斜程度接近，雙眼視覺狀態相對穩定。' };
    }
  }

  // Fallbacks if criteria not strictly met or AC/A missing
  if (nearRaw > distRaw) {
    if (nearType === 'eso') return { type: '內聚過度傾向', desc: '近方內斜量較大，建議確認 AC/A 以區分 CE 或 DI。' };
    if (nearType === 'exo') return { type: '內聚不足傾向', desc: '近方外斜量較大，建議確認 AC/A 以區分 CI 或 DE。' };
  } else if (distRaw > nearRaw) {
    if (distType === 'eso') return { type: '開散不足傾向', desc: '遠方內斜量較大，建議確認 AC/A 以區分 CE 或 DI。' };
    if (distType === 'exo') return { type: '開散過度傾向', desc: '遠方外斜量較大，建議確認 AC/A 以區分 CI 或 DE。' };
  }

  return { type: '正常雙眼視覺狀態', desc: '遠近方斜位量在正常範圍內且程度接近。' };
};

const ComprehensiveAnalysis = ({ data }: { data: VisionData }) => {
  const hasMinData = data.distance.phoriaValue && data.near.phoriaValue;
  if (!hasMinData) return null;

  const result = calculateDysfunctionType(data);

  return (
    <div className="mt-12 p-6 bg-blue-600 rounded-2xl shadow-xl text-white">
      <div className="flex items-center gap-3 mb-4">
        <Activity size={24} className="text-blue-200" />
        <h3 className="text-xl font-bold">綜合聚散功能分析</h3>
      </div>
      <div className="bg-white/10 rounded-xl p-5 backdrop-blur-sm border border-white/20">
        <div className="text-sm font-medium text-blue-100 mb-1 uppercase tracking-wider">初步判定類型</div>
        <div className="text-2xl font-black mb-3 tracking-tight">{result.type}</div>
        <div className="text-sm text-blue-50 opacity-90 leading-relaxed">
          {result.desc}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
          <div className="text-[10px] uppercase font-bold text-blue-200 mb-1">遠近斜位差</div>
          <div className="text-lg font-mono font-bold">
            {Math.abs(parseValue(data.near.phoriaValue) * (data.near.phoriaType === 'eso' ? 1 : -1) - 
             parseValue(data.distance.phoriaValue) * (data.distance.phoriaType === 'eso' ? 1 : -1)).toFixed(1)}Δ
          </div>
        </div>
        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
          <div className="text-[10px] uppercase font-bold text-blue-200 mb-1">AC/A 狀態</div>
          <div className="text-lg font-bold">
            {data.near.phoriaPlus1Value ? '已輸入' : '未輸入'}
          </div>
        </div>
      </div>
    </div>
  );
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
        {results.sheard.applicable && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500 font-medium">Sheard's 準則 (外斜)</span>
            <span className={`font-bold ${results.sheard.met ? 'text-green-600' : 'text-red-600'}`}>
              {results.sheard.message}
            </span>
          </div>
        )}
        {results.oneToOne.applicable && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500 font-medium">1:1 法則 (內斜)</span>
            <span className={`font-bold ${results.oneToOne.met ? 'text-green-600' : 'text-red-600'}`}>
              {results.oneToOne.message}
            </span>
          </div>
        )}
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500 font-medium">Percival's 準則</span>
          <span className={`font-bold ${results.percival.met ? 'text-green-600' : 'text-red-600'}`}>
            {results.percival.message}
          </span>
        </div>

        {results.aca && (
          <div className="flex justify-between items-center text-xs pt-2 border-t border-gray-100 mt-1">
            <span className="text-gray-500 font-bold">AC/A 比值 (Gradient)</span>
            <div className="flex items-center gap-2">
              <span className={`font-bold ${results.aca.status === '正常' ? 'text-blue-600' : 'text-orange-600'}`}>
                {results.aca.status}
              </span>
              <span className="text-gray-900 font-mono font-bold bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm">
                {results.aca.message}
              </span>
            </div>
          </div>
        )}
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
  const [data, setData] = useState<VisionData>(getInitialData());

  const handleInputChange = (
    section: 'distance' | 'near',
    field: string,
    value: string,
    subField?: keyof PrismData
  ) => {
    setData((prev) => {
      const newData = { 
        ...prev,
        [section]: {
          ...prev[section]
        }
      };
      
      if (subField && (field === 'bi' || field === 'bo')) {
        // @ts-ignore
        newData[section][field] = {
          // @ts-ignore
          ...prev[section][field],
          [subField]: value,
        };
      } else {
        // @ts-ignore
        newData[section][field] = value;

        // Auto-switch phoria type based on value
        if (field === 'phoriaValue' || field === 'phoriaPlus1Value') {
          const num = parseFloat(value.replace(/[^\d.-]/g, ''));
          const typeField = field === 'phoriaValue' ? 'phoriaType' : 'phoriaPlus1Type';
          if (num === 0) {
            // @ts-ignore
            newData[section][typeField] = 'ortho';
          } else if (prev[section][typeField] === 'ortho' && value !== '') {
            // @ts-ignore
            newData[section][typeField] = 'exo'; 
          }
        }
      }
      return newData;
    });
  };

  const handleReset = () => {
    setData(getInitialData());
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

              <ComprehensiveAnalysis data={data} />

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

      </div>
    </div>
  );
}
