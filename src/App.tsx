/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Eye, Ruler, Activity, Save, RotateCcw, Info, AlertTriangle } from 'lucide-react';

interface PrismData {
  blur: string;
  break: string;
  recovery: string;
}

interface VisionData {
  age: string;
  fccValue: string;
  fccType: 'plus' | 'minus';
  aa: string;
  blurPoint: string;
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
    nraValue: string;
    nraType: 'plus' | 'minus';
    praValue: string;
    praType: 'plus' | 'minus';
  };
  pd: string;
}

const initialPrismData = (): PrismData => ({
  blur: '',
  break: '',
  recovery: '',
});

const getInitialData = (): VisionData => ({
  age: '',
  fccValue: '',
  fccType: 'plus',
  aa: '',
  blurPoint: '',
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
    nraValue: '',
    nraType: 'plus',
    praValue: '',
    praType: 'minus',
  },
  pd: '',
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
  let acaMethod = 'Gradient';

  if (data.near.phoriaValue !== '' && data.near.phoriaPlus1Value !== '') {
    const p1 = parseValue(data.near.phoriaValue) * (data.near.phoriaType === 'eso' ? 1 : -1);
    const p2 = parseValue(data.near.phoriaPlus1Value) * (data.near.phoriaPlus1Type === 'eso' ? 1 : -1);
    acaValue = Math.abs(p1 - p2);
  } else if (data.distance.phoriaValue !== '' && data.near.phoriaValue !== '' && data.pd !== '') {
    // Calculated AC/A = PD(cm) + 0.4 * (NearPhoria - DistPhoria)
    const pdCm = parseValue(data.pd) / 10; // PD is usually in mm, convert to cm
    const distP = parseValue(data.distance.phoriaValue) * (data.distance.phoriaType === 'eso' ? 1 : -1);
    const nearP = parseValue(data.near.phoriaValue) * (data.near.phoriaType === 'eso' ? 1 : -1);
    acaValue = pdCm + 0.4 * (nearP - distP);
    acaMethod = 'Calculated';
  }

  if (acaValue > 0 && section === 'near') {
    const formattedAca = acaValue % 1 === 0 ? acaValue.toString() : acaValue.toFixed(1);
    acaResult = {
      value: formattedAca,
      message: `${formattedAca} (${acaMethod === 'Gradient' ? '梯度型' : '計算型'})`,
      status: acaValue >= 3 && acaValue <= 5 ? '正常' : acaValue < 3 ? '偏低' : '偏高'
    };
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
  const age = parseValue(data.age);
  let aa = parseValue(data.aa);
  const nra = parseValue(data.near.nraValue) * (data.near.nraType === 'plus' ? 1 : -1);
  const pra = parseValue(data.near.praValue) * (data.near.praType === 'plus' ? 1 : -1);
  const fcc = parseValue(data.fccValue) * (data.fccType === 'plus' ? 1 : -1);

  // If AA is not entered, use |PRA - 2.5| as AA value
  if (data.aa === '' && data.near.praValue !== '') {
    aa = Math.abs(pra - 2.5);
  }

  const hasAccData = !!(data.aa || data.fccValue || data.near.nraValue || data.near.praValue);

  // AC/A calculation
  let aca = 0;
  if (data.near.phoriaValue !== '' && data.near.phoriaPlus1Value !== '') {
    const p1 = parseValue(data.near.phoriaValue) * (data.near.phoriaType === 'eso' ? 1 : -1);
    const p2 = parseValue(data.near.phoriaPlus1Value) * (data.near.phoriaPlus1Type === 'eso' ? 1 : -1);
    aca = Math.abs(p1 - p2);
  } else if (data.distance.phoriaValue !== '' && data.near.phoriaValue !== '' && data.pd !== '') {
    const pdCm = parseValue(data.pd) / 10;
    const distP = parseValue(data.distance.phoriaValue) * (data.distance.phoriaType === 'eso' ? 1 : -1);
    const nearP = parseValue(data.near.phoriaValue) * (data.near.phoriaType === 'eso' ? 1 : -1);
    aca = pdCm + 0.4 * (nearP - distP);
  }

  // Norms
  const isDistNormal = (distType === 'eso' && distRaw <= 1) || (distType === 'exo' && distRaw <= 3) || distType === 'ortho';
  const isNearNormal = (nearType === 'ortho') || (nearType === 'exo' && nearRaw <= 6);

  // AA Norms
  const minAA = 15 - age / 4;
  const maxAA = 25 - 0.4 * age;
  let aaStatus: 'Normal' | 'Low' = 'Normal';
  if (aa > 0) {
    if (aa < minAA) aaStatus = 'Low';
  } else if (data.fccValue !== '') {
    // Use FCC as proxy if AA is missing
    if (fcc > 0.75) aaStatus = 'Low';
  }

  // 1. Accommodation Diagnosis (Determined first)
  let accDiagnosis = "調節正常";
  if (!hasAccData) {
    accDiagnosis = "未提供數據";
  } else {
    const isFCCLag = data.fccValue !== '' && fcc > 0.75;
    const isFCCLead = data.fccValue !== '' && fcc < -0.25;
    const isFCCNormal = data.fccValue !== '' && fcc >= -0.25 && fcc <= 0.75;

    if (isFCCLag) {
      if (aaStatus === 'Low') {
        accDiagnosis = "調節不足";
      } else {
        // AA Normal
        if (data.near.praValue !== '' && pra > -1.25) {
          accDiagnosis = "功能性調節不足";
        } else {
          accDiagnosis = "調節遲緩";
        }
      }
    } else if (isFCCLead) {
      if (aaStatus === 'Low') {
        accDiagnosis = "調節不足且過度使用（痙攣）";
      } else {
        // AA Normal
        if (data.near.nraValue !== '' && nra < 1.50) {
          accDiagnosis = "調節過多";
        } else {
          accDiagnosis = "調節過多 (近用過度使用暫時現象)";
        }
      }
    } else if (isFCCNormal) {
      if (aaStatus === 'Low') {
        accDiagnosis = "目前正常 (潛在在調節不足)";
      } else {
        // AA Normal
        if (data.near.nraValue !== '' && nra < 1.50 && data.near.praValue !== '' && pra > -1.75) {
          accDiagnosis = "調節不靈敏";
        } else {
          accDiagnosis = "正常";
        }
      }
    }
  }

  // 2. Vergence Diagnosis (Determined second, influenced by accommodation)
  let type = "";
  let desc = "";

  if (isDistNormal && isNearNormal) {
    type = "正常 (Normal)";
    desc = "遠方與近方斜位均在臨床標準範圍內。";
  } else if (!isDistNormal && isNearNormal) {
    if (distType === 'exo') {
      type = "開散過度 (Divergence Excess)";
      desc = "遠方外斜視超出標準，近方正常。";
    } else if (distType === 'eso') {
      type = "開散不足 (Divergence Insufficiency)";
      desc = "遠方內斜視超出標準，近方正常。";
    }
  } else if (isDistNormal && !isNearNormal) {
    if (nearType === 'eso') {
      if (aaStatus === 'Normal') {
        type = "集合過度 (Convergence Excess)";
        desc = "近方內斜視，調節功能基本正常。";
      } else if (aaStatus === 'Low') {
        type = "調節不足導致動用更多集合代償";
        desc = "近方內斜視，調節幅度偏低，導致動用更多調節性集合。";
      }
    } else if (nearType === 'exo') {
      if (aaStatus === 'Normal') {
        type = "集合不足 (Convergence Insufficiency)";
        desc = "近方外斜視，調節功能基本正常。";
      } else if (aaStatus === 'Low') {
        type = "假性集合不足(調節不足)";
        desc = "近方外斜視，調節幅度偏低。";
      }
    }
  } else {
    // Both Abnormal
    const distSigned = distRaw * (distType === 'eso' ? 1 : -1);
    const nearSigned = nearRaw * (nearType === 'eso' ? 1 : -1);
    const diff = Math.abs(distSigned - nearSigned);

    if (distType === 'exo' && nearType === 'exo') {
      if (diff <= 4) {
        type = "單純外斜視 (Basic Exophoria)";
        desc = "遠近方均為外斜視且差異在 4Δ 以內。";
      } else if (distRaw > nearRaw) {
        type = "開散過度 (Divergence Excess)";
        desc = "遠近方均為外斜視，且遠方外斜程度大於近方 4Δ 以上。";
      } else {
        type = "集合不足 (Convergence Insufficiency)";
        desc = "遠近方均為外斜視，且近方外斜程度大於遠方 4Δ 以上。";
      }
    } else if (distType === 'eso' && nearType === 'eso') {
      if (diff <= 4) {
        type = "單純內斜視 (Basic Esophoria)";
        desc = "遠近方均為內斜視且差異在 4Δ 以內。";
      } else if (distRaw > nearRaw) {
        type = "開散不足 (Divergence Insufficiency)";
        desc = "遠近方均為內斜視，且遠方內斜程度大於近方 4Δ 以上。";
      } else {
        type = "集合過度 (Convergence Excess)";
        desc = "遠近方均為內斜視，且近方內斜程度大於遠方 4Δ 以上。";
      }
    } else if (distType === 'exo' && nearType === 'eso' && aca > 5) {
      type = "開散過度 + 調節過度";
      desc = "遠方外斜且近方內斜，伴隨高 AC/A 或高調節幅度。";
    } else if (distType === 'eso' && nearType === 'exo') {
      type = "重新確認斜位";
      desc = "遠方內斜且近方外斜，此情況極少見，建議重新測量。";
    } else {
      type = "複合型視功能異常";
      desc = "遠近方斜位均不正常，且不符合單純型分類。";
    }
  }

  return { 
    type, 
    desc, 
    accDiagnosis, 
    aaStatus, 
    minAA, 
    maxAA, 
    hasAccData,
    inputs: {
      aa: data.aa,
      effectiveAA: aa > 0 ? aa.toFixed(2) : null,
      isAAFromPRA: data.aa === '' && data.near.praValue !== '',
      fcc: data.fccValue ? `${data.fccType === 'plus' ? '+' : '-'}${data.fccValue}` : null,
      nra: data.near.nraValue ? `${data.near.nraType === 'plus' ? '+' : '-'}${data.near.nraValue}` : null,
      pra: data.near.praValue ? `${data.near.praType === 'plus' ? '+' : '-'}${data.near.praValue}` : null,
      fccStatus: data.fccValue ? (fcc > 0.75 ? 'Lag' : fcc < 0.25 ? 'Lead' : 'Normal') : null,
      nraStatus: data.near.nraValue ? (nra < 1.75 ? 'Low' : 'Normal') : null,
      praStatus: data.near.praValue ? (Math.abs(pra) < 1.75 ? 'Low' : 'Normal') : null,
    }
  };
};

const ComprehensiveAnalysis = ({ data }: { data: VisionData }) => {
  const result = calculateDysfunctionType(data);
  const hasPhoriaData = !!(data.distance.phoriaValue && data.near.phoriaValue);
  const hasAnyData = hasPhoriaData || result.hasAccData;

  if (!hasAnyData) return null;

  return (
    <div className="mt-12 p-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl shadow-2xl text-white">
      <div className="flex items-center gap-3 mb-8">
        <Activity size={28} className="text-blue-200" />
        <h3 className="text-2xl font-black tracking-tight">綜合視功能分析報告</h3>
      </div>
      
      <div className="flex flex-col gap-8">
        {/* Step 1: Accommodation Diagnosis (Only if data provided) */}
        {result.hasAccData && (
          <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-md border border-white/20 shadow-inner">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-4 bg-blue-400 rounded-full"></div>
                <div className="text-xs font-bold text-blue-200 uppercase tracking-widest">Step 1</div>
              </div>
              <div className="text-xs font-bold text-blue-200 uppercase tracking-widest">調節功能判定</div>
            </div>
            <div className="text-2xl font-black mb-3 leading-tight">{result.accDiagnosis}</div>
            
            {/* Input Values Summary */}
            <div className="flex flex-wrap gap-3 mb-4">
              {result.inputs.effectiveAA && (
                <div className="bg-white/5 px-2 py-1 rounded border border-white/10">
                  <span className="text-[9px] text-blue-200 uppercase font-bold block leading-none mb-1">
                    AA {result.aaStatus === 'Low' ? '(不足)' : '(正常)'}
                    {result.inputs.isAAFromPRA && <span className="ml-1 text-[8px] opacity-60">(由PRA推估)</span>}
                  </span>
                  <span className="text-xs font-mono font-bold">{result.inputs.effectiveAA} D</span>
                </div>
              )}
              {result.inputs.fcc && (
                <div className="bg-white/5 px-2 py-1 rounded border border-white/10">
                  <span className="text-[9px] text-blue-200 uppercase font-bold block leading-none mb-1">
                    FCC {result.inputs.fccStatus === 'Lag' ? '(Lag)' : result.inputs.fccStatus === 'Lead' ? '(Lead)' : ''}
                  </span>
                  <span className="text-xs font-mono font-bold">{result.inputs.fcc} D</span>
                </div>
              )}
              {result.inputs.nra && (
                <div className="bg-white/5 px-2 py-1 rounded border border-white/10">
                  <span className="text-[9px] text-blue-200 uppercase font-bold block leading-none mb-1">
                    NRA {result.inputs.nraStatus === 'Low' ? '(Low)' : ''}
                  </span>
                  <span className="text-xs font-mono font-bold">{result.inputs.nra} D</span>
                </div>
              )}
              {result.inputs.pra && (
                <div className="bg-white/5 px-2 py-1 rounded border border-white/10">
                  <span className="text-[9px] text-blue-200 uppercase font-bold block leading-none mb-1">
                    PRA {result.inputs.praStatus === 'Low' ? '(Low)' : ''}
                  </span>
                  <span className="text-xs font-mono font-bold">{result.inputs.pra} D</span>
                </div>
              )}
            </div>

            {data.age && (
              <div className="space-y-2 mt-4 pt-4 border-t border-white/10">
                <div className="flex justify-between text-[10px] font-bold text-blue-200 uppercase tracking-wider">
                  <span>調節幅度 (AA) 參考值</span>
                  <span className={`px-1.5 py-0.5 rounded ${result.aaStatus === 'Low' ? 'bg-red-500/40' : 'bg-green-500/40'}`}>
                    {result.aaStatus === 'Low' ? '調節力量不足' : '調節力量正常'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/5 rounded p-1.5">
                    <div className="text-[9px] opacity-60">最小值</div>
                    <div className="text-xs font-mono font-bold">{result.minAA.toFixed(1)}</div>
                  </div>
                  <div className="bg-white/5 rounded p-1.5">
                    <div className="text-[9px] opacity-60">平均值</div>
                    <div className="text-xs font-mono font-bold">{(18.7 - 0.3 * parseValue(data.age)).toFixed(1)}</div>
                  </div>
                  <div className="bg-white/5 rounded p-1.5">
                    <div className="text-[9px] opacity-60">最大值</div>
                    <div className="text-xs font-mono font-bold">{result.maxAA.toFixed(1)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Primary Diagnosis (Vergence) */}
        {hasPhoriaData && (
          <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-md border border-white/20 shadow-inner">
            <div className="flex items-center gap-2 mb-3">
              {result.hasAccData && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-4 bg-indigo-400 rounded-full"></div>
                  <div className="text-xs font-bold text-indigo-200 uppercase tracking-widest">Step 2</div>
                </div>
              )}
              <div className="text-xs font-bold text-blue-200 uppercase tracking-widest">聚散功能判定</div>
            </div>
            <div className="text-2xl font-black mb-3 leading-tight">{result.type}</div>
            <p className="text-sm text-blue-50 leading-relaxed opacity-90">
              {result.desc}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {hasPhoriaData && (
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
            <div className="text-[10px] uppercase font-bold text-blue-200 mb-1">遠近斜位差</div>
            <div className="text-xl font-mono font-black">
              {Math.abs(parseValue(data.near.phoriaValue) * (data.near.phoriaType === 'eso' ? 1 : -1) - 
               parseValue(data.distance.phoriaValue) * (data.distance.phoriaType === 'eso' ? 1 : -1)).toFixed(1)}Δ
            </div>
          </div>
        )}
        {hasPhoriaData && (
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
            <div className="text-[10px] uppercase font-bold text-blue-200 mb-1">AC/A 比值</div>
            <div className="text-sm font-mono font-bold">
              {calculateAnalysis(data, 'near').aca?.message || '-'}
            </div>
          </div>
        )}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
          <div className="text-[10px] uppercase font-bold text-blue-200 mb-1">NRA/PRA</div>
          <div className="text-sm font-mono font-bold">
            {data.near.nraValue ? (data.near.nraType === 'plus' ? '+' : '-') + data.near.nraValue : '-'}/
            {data.near.praValue ? (data.near.praType === 'plus' ? '+' : '-') + data.near.praValue : '-'}
          </div>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
          <div className="text-[10px] uppercase font-bold text-blue-200 mb-1">FCC 狀態</div>
          <div className="text-xl font-mono font-black">
            {data.fccValue ? (data.fccType === 'plus' ? '+' : '-') + data.fccValue : '-'}
          </div>
        </div>
      </div>

      {/* Result Interpretation Warning */}
      <div className="mt-8 pt-6 border-t border-white/10 text-center space-y-1">
        <p className="text-[11px] text-blue-200/60 leading-relaxed font-medium">
          分析結果受受測者主觀反應、疲勞程度及測試環境影響，僅反映當下視覺狀態。
        </p>
        <p className="text-[11px] text-blue-200/60 leading-relaxed font-medium">
          結果僅供參考，任何視覺訓練或配鏡決策應由專業人員經完整評估後。
        </p>
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

const SectionHeader = ({ icon: Icon, title, subtitle, children, hideIcon }: { icon: any, title: string, subtitle: string, children?: React.ReactNode, hideIcon?: boolean }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-gray-200 pb-4">
    <div className="flex items-center gap-3">
      {!hideIcon && (
        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
          <Icon size={24} />
        </div>
      )}
      <div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
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
  const [mode, setMode] = useState<'simple' | 'professional' | 'intro'>('professional');
  const [aaInputMode, setAaInputMode] = useState<'push-up' | 'direct'>('push-up');

  const handleInputChange = (
    section: 'distance' | 'near' | 'general',
    field: string,
    value: string,
    subField?: keyof PrismData
  ) => {
    // Only filter if it's a numeric field. Type fields (exo/eso, plus/minus) should not be filtered.
    const isTypeField = field.toLowerCase().includes('type');
    const filteredValue = isTypeField ? value : value.replace(/－/g, '-').replace(/[^\d.-]/g, '');

    setData((prev) => {
      if (section === 'general') {
        let finalValue = filteredValue;
        
        // Auto-format FCC & AA: "200" -> "2.00"
        if (field === 'fccValue' || field === 'aa') {
          const digits = filteredValue.replace(/[^\d]/g, '');
          if (digits.length === 3) {
            finalValue = (parseInt(digits) / 100).toFixed(2);
          }
        }

        const newData = { ...prev, [field]: finalValue };
        
        // Auto-calculate AA from Blur Point (Push-up method)
        if (field === 'blurPoint') {
          const cm = parseFloat(finalValue);
          if (!isNaN(cm) && cm > 0) {
            newData.aa = (100 / cm).toFixed(1);
          } else if (finalValue === '') {
            newData.aa = '';
          }
        }
        
        // Auto-calculate Blur Point from AA (Direct method)
        if (field === 'aa') {
          const d = parseFloat(finalValue);
          if (!isNaN(d) && d > 0) {
            newData.blurPoint = (100 / d).toFixed(1);
          } else if (finalValue === '') {
            newData.blurPoint = '';
          }
        }
        
        return newData;
      }

      const newData = { 
        ...prev,
        [section]: {
          ...prev[section]
        }
      };
      
      let finalValue = filteredValue;
      // Auto-format NRA/PRA: "200" -> "2.00"
      if (field === 'nraValue' || field === 'praValue') {
        const digits = filteredValue.replace(/[^\d]/g, '');
        if (digits.length === 3) {
          finalValue = (parseInt(digits) / 100).toFixed(2);
        }
      }

      if (subField && (field === 'bi' || field === 'bo')) {
        // @ts-ignore
        newData[section][field] = {
          // @ts-ignore
          ...prev[section][field],
          [subField]: finalValue,
        };
      } else {
        // @ts-ignore
        newData[section][field] = finalValue;

        // Auto-switch phoria type based on value
        if (field === 'phoriaValue' || field === 'phoriaPlus1Value') {
          const num = parseFloat(filteredValue);
          const typeField = field === 'phoriaValue' ? 'phoriaType' : 'phoriaPlus1Type';
          if (num === 0) {
            // @ts-ignore
            newData[section][typeField] = 'ortho';
          } else if (prev[section][typeField] === 'ortho' && filteredValue !== '') {
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
        'general-age',
        'general-pd',
        'dist-phoria',
        'dist-bi-blur', 'dist-bi-break', 'dist-bi-recovery',
        'dist-bo-blur', 'dist-bo-break', 'dist-bo-recovery',
        'near-phoria',
        'near-phoria-plus1',
        'near-bi-blur', 'near-bi-break', 'near-bi-recovery',
        'near-bo-blur', 'near-bo-break', 'near-bo-recovery',
        'near-nra',
        'near-pra',
        'near-blur-point',
        'near-aa',
        'near-fcc'
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
        {/* Top Warning */}
        <div className="mb-6 text-center">
          <p className="text-[10px] font-bold text-red-600 tracking-tight">
            此工具僅為雙眼視覺功能分析輔助，所有輸入與操作結果僅供參考。
          </p>
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
            雙眼視覺分析
          </h1>
          <div className="mt-3 flex items-center justify-center gap-3">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              製作者 Tony
            </div>
          </div>
          <div className="flex justify-center gap-8 mt-6">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="mode"
                checked={mode === 'simple'}
                onChange={() => setMode('simple')}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className={`text-sm font-medium transition-colors ${mode === 'simple' ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'}`}>
                簡易模式
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="mode"
                checked={mode === 'professional'}
                onChange={() => setMode('professional')}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className={`text-sm font-medium transition-colors ${mode === 'professional' ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'}`}>
                專業模式
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="mode"
                checked={mode === 'intro'}
                onChange={() => setMode('intro')}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className={`text-sm font-medium transition-colors ${mode === 'intro' ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'}`}>
                介紹模式
              </span>
            </label>
          </div>
        </div>

        {mode === 'intro' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
            <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-4">
              <Info className="text-blue-600" size={28} />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">臨床指標與異常定義</h2>
                <p className="text-sm text-gray-500">了解各項數據的臨床意義與診斷標準</p>
              </div>
            </div>

            <div className="space-y-10">
              {/* Accommodation Section */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="text-blue-500" size={20} />
                  <h3 className="text-lg font-bold text-gray-800">調節功能指標 (Accommodation)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                    <div className="font-bold text-blue-900 mb-1">AA</div>
                    <div className="text-[10px] text-blue-600 font-bold mb-2">調節幅度</div>
                    <p className="text-xs text-blue-800 leading-relaxed">眼睛能產生的最大調節力。隨年齡增加而減少，是判斷調節不足的核心指標。</p>
                  </div>
                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                    <div className="font-bold text-blue-900 mb-1">FCC</div>
                    <div className="text-[10px] text-blue-600 font-bold mb-2">調節反應</div>
                    <p className="text-xs text-blue-800 leading-relaxed">測量調節滯後 (Lag) 或超前 (Lead)。正常值約 +0.25D 至 +0.75D。</p>
                  </div>
                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                    <div className="font-bold text-blue-900 mb-1">NRA</div>
                    <div className="text-[10px] text-blue-600 font-bold mb-2">負相對調節</div>
                    <p className="text-xs text-blue-800 leading-relaxed">在集合固定下放鬆調節的能力。正常約 +2.00D 至 +2.50D，過低暗示調節過度。</p>
                  </div>
                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                    <div className="font-bold text-blue-900 mb-1">PRA</div>
                    <div className="text-[10px] text-blue-600 font-bold mb-2">正相對調節</div>
                    <p className="text-xs text-blue-800 leading-relaxed">在集合固定下增加調節的能力。正常應小於 -2.37D，過低暗示調節疲勞或不足。</p>
                  </div>
                </div>
              </section>

              {/* Phoria Section */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="text-teal-500" size={20} />
                  <h3 className="text-lg font-bold text-gray-800">基礎斜位定義 (Phoria)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-100">
                    <div className="font-bold text-teal-900 mb-1">遠方斜位</div>
                    <div className="text-[10px] text-teal-600 font-bold mb-2">Distance Phoria (6m)</div>
                    <p className="text-xs text-teal-800 leading-relaxed">
                      測量眼睛在看遠時的靜止位置。外斜 (Exo) 代表眼睛趨向外展，內斜 (Eso) 代表趨向內收。正常值約為 0.5Δ 外斜至 1Δ 內斜。
                    </p>
                  </div>
                  <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-100">
                    <div className="font-bold text-teal-900 mb-1">近方斜位</div>
                    <div className="text-[10px] text-teal-600 font-bold mb-2">Near Phoria (40cm)</div>
                    <p className="text-xs text-teal-800 leading-relaxed">
                      測量眼睛在看近時的靜止位置。由於近距離有調節性集合參與，正常值通常比遠方更偏向外斜（約 3Δ 外斜）。
                    </p>
                  </div>
                </div>
              </section>

              {/* Vergence Section */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="text-indigo-500" size={20} />
                  <h3 className="text-lg font-bold text-gray-800">聚散功能異常 (Vergence)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Distance Priority */}
                  <div className="space-y-4">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">遠方為主</div>
                    <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <div className="font-bold text-indigo-900 mb-1">開散不足</div>
                      <p className="text-xs text-indigo-800 leading-relaxed">遠方內斜程度顯著大於近方 (相差 5Δ 以上)。</p>
                    </div>
                    <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <div className="font-bold text-indigo-900 mb-1">開散過度</div>
                      <p className="text-xs text-indigo-800 leading-relaxed">遠方外斜程度顯著大於近方 (相差 5Δ 以上)。</p>
                    </div>
                  </div>
                  {/* Near Priority */}
                  <div className="space-y-4">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">近方為主</div>
                    <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <div className="font-bold text-indigo-900 mb-1">集合不足</div>
                      <p className="text-xs text-indigo-800 leading-relaxed">近方外斜程度顯著大於遠方 (相差 5Δ 以上)。</p>
                    </div>
                    <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <div className="font-bold text-indigo-900 mb-1">集合過度</div>
                      <p className="text-xs text-indigo-800 leading-relaxed">近方內斜程度顯著大於遠方 (相差 5Δ 以上)。</p>
                    </div>
                  </div>
                  {/* Basic Types */}
                  <div className="space-y-4">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">遠近一致</div>
                    <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <div className="font-bold text-indigo-900 mb-1">單純內斜</div>
                      <p className="text-xs text-indigo-800 leading-relaxed">遠近方均為內斜視，且兩者程度相近 (5Δ 以內)。</p>
                    </div>
                    <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <div className="font-bold text-indigo-900 mb-1">單純外斜</div>
                      <p className="text-xs text-indigo-800 leading-relaxed">遠近方均為外斜視，且兩者程度相近 (5Δ 以內)。</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Calculation Section */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Ruler className="text-orange-500" size={20} />
                  <h3 className="text-lg font-bold text-gray-800">關鍵計算指標 (Calculations)</h3>
                </div>
                <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-100">
                  <div className="font-bold text-orange-900 mb-1">AC/A Ratio</div>
                  <div className="text-[10px] text-orange-600 font-bold mb-2">調節性集合與調節的比值</div>
                  <p className="text-xs text-orange-800 leading-relaxed">
                    反映調節對集合系統的驅動力。高 AC/A 易導致集合過度或開散過度；低 AC/A 則與集合不足或開散不足相關。
                    本系統支援「梯度型」與「計算型」兩種算法。
                  </p>
                </div>
              </section>
            </div>

          </div>
        ) : (
          <>
            {/* Box Reset Button */}
            <div className="flex justify-end mb-2">
              <button
                onClick={handleReset}
                title="清除所有數據"
                className="p-2 bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 rounded-xl transition-all shadow-sm group"
              >
                <RotateCcw size={18} className="group-hover:rotate-[-45deg] transition-transform" />
              </button>
            </div>

            {/* General Info Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
              <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
                <div className="grid grid-cols-2 gap-4 w-full sm:w-auto">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">
                      受檢者年齡 (Age)
                    </label>
                    <div className="relative">
                      <input
                        id="general-age"
                        type="text"
                        value={data.age}
                        onChange={(e) => handleInputChange('general', 'age', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, 'general-age')}
                        placeholder="例如: 25"
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">歲</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">
                      瞳距 (PD)
                    </label>
                    <div className="relative">
                      <input
                        id="general-pd"
                        type="text"
                        value={data.pd}
                        onChange={(e) => handleInputChange('general', 'pd', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, 'general-pd')}
                        placeholder="例如: 64"
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">mm</span>
                    </div>
                  </div>
                </div>
                <div className="hidden lg:block flex-1 text-right">
                  <div className="inline-block text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">
                    臨床診斷輔助系統
                  </div>
                </div>
              </div>
            </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Distance Section (6m) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <SectionHeader 
              icon={Ruler} 
              title="遠方數據" 
              subtitle={mode === 'professional' ? "6 公尺" : ""}
              hideIcon={mode === 'simple'}
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
              {mode === 'professional' && (
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
              )}

              {mode === 'professional' && <AnalysisCard data={data} section="distance" />}
            </div>
          </div>

          {/* Near Section (40cm) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <SectionHeader 
              icon={Activity} 
              title="近方數據" 
              subtitle={mode === 'professional' ? "40 公分" : ""}
              hideIcon={mode === 'simple'}
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
              {mode === 'professional' && (
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
              )}

              {mode === 'professional' && <AnalysisCard data={data} section="near" />}

              {mode === 'professional' && <ComprehensiveAnalysis data={data} />}

              {/* Accommodation */}
              <div className="pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                    調節功能 (Accommodation)
                  </label>
                  <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                    <button
                      onClick={() => setAaInputMode('push-up')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                        aaInputMode === 'push-up'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      推進法
                    </button>
                    <button
                      onClick={() => setAaInputMode('direct')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                        aaInputMode === 'direct'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      調節幅度
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1">
                    <span className="text-xs text-gray-500 font-medium">NRA (+)</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleInputChange('near', 'nraType', data.near.nraType === 'plus' ? 'minus' : 'plus')}
                        className="px-3 py-2 bg-gray-100 text-blue-600 font-bold rounded-lg border border-gray-200 hover:bg-gray-200 transition-all min-w-[40px]"
                      >
                        {data.near.nraType === 'plus' ? '+' : '-'}
                      </button>
                      <div className="relative flex-1">
                        <input
                          id="near-nra"
                          type="text"
                          value={data.near.nraValue}
                          onChange={(e) => handleInputChange('near', 'nraValue', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, 'near-nra')}
                          placeholder="2.00"
                          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-300"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">D</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-gray-500 font-medium">PRA (-)</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleInputChange('near', 'praType', data.near.praType === 'plus' ? 'minus' : 'plus')}
                        className="px-3 py-2 bg-gray-100 text-blue-600 font-bold rounded-lg border border-gray-200 hover:bg-gray-200 transition-all min-w-[40px]"
                      >
                        {data.near.praType === 'plus' ? '+' : '-'}
                      </button>
                      <div className="relative flex-1">
                        <input
                          id="near-pra"
                          type="text"
                          value={data.near.praValue}
                          onChange={(e) => handleInputChange('near', 'praValue', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, 'near-pra')}
                          placeholder="2.37"
                          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-300"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">D</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {aaInputMode === 'push-up' ? (
                    <div className="space-y-1">
                      <span className="text-xs text-gray-500 font-medium">推進法模糊點</span>
                      <div className="relative">
                        <input
                          id="near-blur-point"
                          type="text"
                          value={data.blurPoint}
                          onChange={(e) => handleInputChange('general', 'blurPoint', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, 'near-blur-point')}
                          placeholder="例如: 10"
                          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-300"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">cm</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        自動換算 AA: {data.aa || '0'} D
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="text-xs text-gray-500 font-medium">調節幅度 (AA)</span>
                      <div className="relative">
                        <input
                          id="near-aa"
                          type="text"
                          value={data.aa}
                          onChange={(e) => handleInputChange('general', 'aa', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, 'near-aa')}
                          placeholder="例如: 10.0"
                          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-300"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">D</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        自動換算 AA: {data.aa || '0'} D (模糊點: {data.blurPoint || '0'} cm)
                      </p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <span className="text-xs text-gray-500 font-medium">調節反應 (FCC)</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleInputChange('general', 'fccType', data.fccType === 'plus' ? 'minus' : 'plus')}
                        className="px-3 py-2 bg-gray-100 text-blue-600 font-bold rounded-lg border border-gray-200 hover:bg-gray-200 transition-all min-w-[40px]"
                      >
                        {data.fccType === 'plus' ? '+' : '-'}
                      </button>
                      <div className="relative flex-1">
                        <input
                          id="near-fcc"
                          type="text"
                          value={data.fccValue}
                          onChange={(e) => handleInputChange('general', 'fccValue', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, 'near-fcc')}
                          placeholder="0.50"
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

        {mode === 'simple' && (
          <div className="mt-8">
            <ComprehensiveAnalysis data={data} />
          </div>
        )}
      </>
    )}

        {/* Footer Disclaimer */}
        <div className="mt-12 pt-8 border-t border-gray-200 text-center max-w-2xl mx-auto space-y-1">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            本系統及其分析結果不構成醫療診斷、處方或治療依據。
          </p>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            使用者不得依本系統自行進行任何醫療決策，包括配鏡、視覺訓練或治療。
          </p>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            如有任何視覺異常或不適症狀，應立即諮詢合格眼科醫師或專業驗光人員。
          </p>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            系統開發者對使用結果所引起的任何直接或間接損失概不負責。
          </p>
        </div>
      </div>
    </div>
  );
}
