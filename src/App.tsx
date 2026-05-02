/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Eye, Ruler, Activity, Save, RotateCcw, Info, AlertTriangle, Plus } from 'lucide-react';

interface PrismData {
  blur: string;
  break: string;
  recovery: string;
}

interface VisionData {
  birthDate: string;
  fccValue: string;
  fccType: 'plus' | 'minus';
  aa: string;
  blurPoint: string;
  addValue: string;
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
  birthDate: '',
  fccValue: '',
  fccType: 'plus',
  aa: '',
  blurPoint: '',
  addValue: '',
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

const calculateAge = (birthDate: string) => {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
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
  const age = calculateAge(data.birthDate);
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
    const isFCCLead = data.fccValue !== '' && fcc < 0;
    const isFCCNormal = data.fccValue !== '' && fcc >= 0 && fcc <= 0.75;

    if (data.near.nraValue !== '' && nra < 1.50 && data.near.praValue !== '' && pra > -1.75) {
      accDiagnosis = "調節不靈敏";
    } else if (isFCCNormal && data.near.praValue !== '' && pra > -1.25) {
      accDiagnosis = "潛在調節不足";
    } else if (isFCCLag) {
      if (aaStatus === 'Low') {
        accDiagnosis = "調節不足";
      } else {
        // AA Normal
        if (data.near.praValue !== '' && pra > -1.25) {
          accDiagnosis = "調節不足";
        } else {
          accDiagnosis = "調節遲緩";
        }
      }
    } else if (isFCCLead) {
      if (aaStatus === 'Low') {
        accDiagnosis = "調節力不足且過度使用（痙攣）";
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
        accDiagnosis = "目前正常 (潛在調節不足)";
      } else {
        // AA Normal
        accDiagnosis = "正常範圍";
      }
    } else if (aa > 0) {
      // Only AA and Age are provided
      accDiagnosis = aaStatus === 'Low' ? "調節幅度不足" : "調節幅度正常";
    } else {
      accDiagnosis = "正常範圍";
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
      desc = "遠方外斜位超出標準，近方正常。";
    } else if (distType === 'eso') {
      type = "開散不足 (Divergence Insufficiency)";
      desc = "遠方內斜位超出標準，近方正常。";
    }
  } else if (isDistNormal && !isNearNormal) {
    if (nearType === 'eso') {
      if (aaStatus === 'Normal') {
        type = "集合過度 (Convergence Excess)";
        desc = "近方內斜位，調節系統基本正常。";
      } else if (aaStatus === 'Low') {
        type = "調節不足導致動用更多集合代償";
        desc = "近方內斜位，調節幅度偏低，導致動用更多調節性集合。";
      }
    } else if (nearType === 'exo') {
      if (aaStatus === 'Normal') {
        type = "集合不足 (Convergence Insufficiency)";
        desc = "近方外斜位，調節系統基本正常。";
      } else if (aaStatus === 'Low') {
        type = "假性集合不足(調節不足)";
        desc = "近方外斜位，調節幅度偏低。";
      }
    }
  } else {
    // Both Abnormal
    const distSigned = distRaw * (distType === 'eso' ? 1 : -1);
    const nearSigned = nearRaw * (nearType === 'eso' ? 1 : -1);
    const diff = Math.abs(distSigned - nearSigned);

    if (distType === 'exo' && nearType === 'exo') {
      if (diff <= 4) {
        type = "單純外斜位 (Basic Exophoria)";
        desc = "遠近方均為外斜位且差異在 4Δ 以內。";
      } else if (distRaw > nearRaw) {
        type = "開散過度 (Divergence Excess)";
        desc = "遠近方均為外斜位，且遠方外斜程度大於近方 4Δ 以上。";
      } else {
        type = "集合不足 (Convergence Insufficiency)";
        desc = "遠近方均為外斜位，且近方外斜程度大於遠方 4Δ 以上。";
      }
    } else if (distType === 'eso' && nearType === 'eso') {
      if (diff <= 4) {
        type = "單純內斜位 (Basic Esophoria)";
        desc = "遠近方均為內斜位且差異在 4Δ 以內。";
      } else if (distRaw > nearRaw) {
        type = "開散不足 (Divergence Insufficiency)";
        desc = "遠近方均為內斜位，且遠方內斜程度大於近方 4Δ 以上。";
      } else {
        type = "集合過度 (Convergence Excess)";
        desc = "遠近方均為內斜位，且近方內斜程度大於遠方 4Δ 以上。";
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
  const nearAnalysis = calculateAnalysis(data, 'near');
  const distAnalysis = calculateAnalysis(data, 'distance');
  
  // More granular data presence checks
  const hasDistPhoria = data.distance.phoriaValue !== '';
  const hasNearPhoria = data.near.phoriaValue !== '';
  const hasDistPrism = hasDistPhoria && (data.distance.bi.break !== '' || data.distance.bi.blur !== '' || data.distance.bo.break !== '' || data.distance.bo.blur !== '');
  const hasNearPrism = hasNearPhoria && (data.near.bi.break !== '' || data.near.bi.blur !== '' || data.near.bo.break !== '' || data.near.bo.blur !== '');
  const hasAccData = result.hasAccData;
  const hasACAData = !!nearAnalysis.aca;

  // Analysis report should show if we have ANY meaningful data
  const hasAnyData = hasDistPhoria || hasNearPhoria || hasAccData || hasDistPrism || hasNearPrism;

  const getManagementInfo = (diagnosis: string) => {
    // Accommodation mapping
    if (diagnosis.includes("調節力不足且過度使用")) {
      return {
        symptoms: "長時間近距離工作疲勞、想睡；看遠近易模糊，看近更明顯且無法集中；頭痛、眼周牽扯感；閱讀字體移動感；眼乾、畏光、流淚",
        treatment: "1.屈光矯正 2.加入正度數 3.推進訓練 (Brock線)",
        type: "danger"
      };
    }
    if (diagnosis.includes("調節不足") && !diagnosis.includes("潛在")) {
      return {
        symptoms: "長時間近距離工作疲勞、想睡；看遠近易模糊，看近更明顯且無法集中；頭痛、眼周牽扯感；閱讀字體移動感；眼乾、畏光、流淚",
        treatment: "1.屈光矯正 2.加入正度數 3.推進訓練 (Brock線)",
        type: "danger"
      };
    }
    if (diagnosis.includes("潛在調節不足")) {
      return {
        symptoms: "症狀較不明顯（輕微模糊、疲勞），但可能出現調節不足前兆",
        treatment: "1.屈光矯正 2.加入正度數",
        type: "warning"
      };
    }
    if (diagnosis.includes("調節遲緩")) {
      return {
        symptoms: "近方模糊（對焦慢）、視覺疲勞",
        treatment: "1.屈光矯正 2.加入正度數或多休息",
        type: "warning"
      };
    }
    if (diagnosis.includes("調節不靈敏")) {
      return {
        symptoms: "遠近切換困難、對焦緩慢；閱讀困難、注意力下降、嗜睡；頭痛、眼脹；閱讀字體有移動感",
        treatment: "1.屈光矯正 2.反轉鏡訓練、遠近字母法",
        type: "warning"
      };
    }
    if (diagnosis.includes("調節過多") || diagnosis.includes("調節過度")) {
      return {
        symptoms: "畏光；長時間看近後遠近均模糊（晚上明顯）；近距工作後頭痛、眼脹；疲勞後遠近切換困難",
        treatment: "1.屈光矯正 2.加入正度數",
        type: "primary"
      };
    }

    // Vergence mapping
    if (diagnosis.includes("集合不足")) {
      return {
        symptoms: "看近複視、模糊、聚焦困難；眼部緊張感、酸脹；閱讀後眼周疼痛；無法集中；傾向避免看近",
        treatment: "1.屈光矯正 2.加入正度數（可改善調節不足） 3.近用 BI 4.推進訓練、Brock線",
        type: "danger"
      };
    }
    if (diagnosis.includes("假性集合不足")) {
      return {
        symptoms: "症狀與集合不足相似，但主因是調節不足導致不願動用調節性集合",
        treatment: "1.屈光矯正 2.加入正度數 3.調節系統訓練",
        type: "warning"
      };
    }
    if (diagnosis.includes("集合過度")) {
      return {
        symptoms: "複視、模糊（遠近均可能）；疲勞後頭部傾斜；聚焦過度感（短時閱讀即疲勞）；晚間眼眶上方疼痛；傾向避免看近（或拿極近）；想閉眼",
        treatment: "1.屈光矯正 2.加入正度數 3.近用加入 BO",
        type: "danger"
      };
    }
    if (diagnosis.includes("開散不足")) {
      return {
        symptoms: "看遠方複視、頭疼",
        treatment: "遠距加入 BO 處理",
        type: "primary"
      };
    }
    if (diagnosis.includes("開散過度")) {
      return {
        symptoms: "看遠方複視和視覺疲勞",
        treatment: "遠距加入 BI 處理或加入負度數刺激調節",
        type: "primary"
      };
    }
    if (diagnosis.includes("單純外斜位") || diagnosis.includes("單純外斜")) {
      return {
        symptoms: "近距離工作易出現眼部緊張或頭疼等；遠近可能視力模糊或複視",
        treatment: "加入 BI 處理或調節沒問題者可加入負度數",
        type: "warning"
      };
    }
    if (diagnosis.includes("單純內斜位") || diagnosis.includes("單純內斜")) {
      return {
        symptoms: "近距工作容易疲勞；遠近用眼偶爾視力模糊或複視",
        treatment: "加入 BO 處理",
        type: "warning"
      };
    }
    return null;
  };

  const managementInfoAcc = getManagementInfo(result.accDiagnosis);
  const managementInfoVerg = getManagementInfo(result.type);

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
              <div className="text-xs font-bold text-blue-200 uppercase tracking-widest">調節系統判定</div>
            </div>
            <div className="text-2xl font-black mb-1 leading-tight">{result.accDiagnosis}</div>
            
            {managementInfoAcc && (
              <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">常見症狀</p>
                    <p className="text-xs text-blue-50 font-medium leading-relaxed">{managementInfoAcc.symptoms}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">建議處理方法</p>
                    <p className="text-xs text-yellow-300 font-bold leading-relaxed">{managementInfoAcc.treatment}</p>
                  </div>
                </div>
              </div>
            )}
            
            {data.birthDate && (
              <div className="space-y-2 mt-4 pt-4 border-t border-white/10">
                <div className="flex justify-between text-[10px] font-bold text-blue-200 uppercase tracking-wider">
                  <span>調節幅度 (AA) 參考值 (年齡: {calculateAge(data.birthDate)} 歲)</span>
                  <span className={`px-1.5 py-0.5 rounded ${result.aaStatus === 'Low' ? 'bg-red-500/40' : 'bg-green-500/40'}`}>
                    {result.aaStatus === 'Low' ? '調節幅度不足' : '調節幅度正常'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/5 rounded p-1.5">
                    <div className="text-[9px] opacity-60">最小值</div>
                    <div className="text-xs font-mono font-bold">{result.minAA.toFixed(1)}</div>
                  </div>
                  <div className="bg-white/5 rounded p-1.5">
                    <div className="text-[9px] opacity-60">平均值</div>
                    <div className="text-xs font-mono font-bold">{(18.7 - 0.3 * calculateAge(data.birthDate)).toFixed(1)}</div>
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
        {(hasDistPhoria && hasNearPhoria) && (
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
            <p className="text-sm text-blue-50 leading-relaxed opacity-90 mb-4">
              {result.desc}
            </p>

            {managementInfoVerg && (
              <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">常見症狀</p>
                    <p className="text-xs text-blue-50 font-medium leading-relaxed">{managementInfoVerg.symptoms}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">建議處理方法</p>
                    <p className="text-xs text-yellow-300 font-bold leading-relaxed">{managementInfoVerg.treatment}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-10 flex flex-col items-center gap-8">
        {hasACAData && (
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center min-w-[280px]">
            <div className="text-[10px] uppercase font-black text-blue-200 mb-2 tracking-[0.2em]">AC/A Ratio</div>
            <div className="text-xl font-mono font-black text-white">
              {nearAnalysis.aca?.message || '-'}
            </div>
          </div>
        )}
        
        {/* The Three Rules - Only show if we have prism data */}
        {(hasDistPrism || hasNearPrism) && (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 w-full">
            {/* Distance Column Rules */}
            {hasDistPrism ? (
              <div className="space-y-3">
                <div className="text-center">
                  <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.1em] text-blue-200/60 flex items-center justify-center gap-1 sm:gap-2">
                    <div className="h-[1px] flex-1 bg-white/10"></div>
                    遠方 3大法則
                    <div className="h-[1px] flex-1 bg-white/10"></div>
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="bg-white/5 rounded-lg p-2 sm:p-3 border border-white/10 text-center">
                    <div className="text-[8px] uppercase font-bold text-blue-200/60">Sheard's</div>
                    <div className={`text-[10px] sm:text-[11px] font-bold ${distAnalysis.sheard.met ? 'text-green-300' : 'text-red-300'}`}>
                      {distAnalysis.sheard.applicable ? distAnalysis.sheard.message : '不適用'}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 sm:p-3 border border-white/10 text-center">
                    <div className="text-[8px] uppercase font-bold text-blue-200/60">1:1 Rule</div>
                    <div className={`text-[10px] sm:text-[11px] font-bold ${distAnalysis.oneToOne.met ? 'text-green-300' : 'text-red-300'}`}>
                      {distAnalysis.oneToOne.applicable ? distAnalysis.oneToOne.message : '不適用'}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 sm:p-3 border border-white/10 text-center">
                    <div className="text-[8px] uppercase font-bold text-blue-200/60">Percival's</div>
                    <div className={`text-[10px] sm:text-[11px] font-bold ${distAnalysis.percival.met ? 'text-green-300' : 'text-red-300'}`}>
                      {distAnalysis.percival.message}
                    </div>
                  </div>
                </div>
              </div>
            ) : <div />}

            {/* Near Column Rules */}
            {hasNearPrism ? (
              <div className="space-y-3">
                <div className="text-center">
                  <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.1em] text-emerald-200/60 flex items-center justify-center gap-1 sm:gap-2">
                    <div className="h-[1px] flex-1 bg-white/10"></div>
                    近方 3大法則
                    <div className="h-[1px] flex-1 bg-white/10"></div>
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="bg-white/5 rounded-lg p-2 sm:p-3 border border-white/10 text-center">
                    <div className="text-[8px] uppercase font-bold text-blue-200/60">Sheard's</div>
                    <div className={`text-[10px] sm:text-[11px] font-bold ${nearAnalysis.sheard.met ? 'text-green-300' : 'text-red-300'}`}>
                      {nearAnalysis.sheard.applicable ? nearAnalysis.sheard.message : '不適用'}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 sm:p-3 border border-white/10 text-center">
                    <div className="text-[8px] uppercase font-bold text-blue-200/60">1:1 Rule</div>
                    <div className={`text-[10px] sm:text-[11px] font-bold ${nearAnalysis.oneToOne.met ? 'text-green-300' : 'text-red-300'}`}>
                      {nearAnalysis.oneToOne.applicable ? nearAnalysis.oneToOne.message : '不適用'}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 sm:p-3 border border-white/10 text-center">
                    <div className="text-[8px] uppercase font-bold text-blue-200/60">Percival's</div>
                    <div className={`text-[10px] sm:text-[11px] font-bold ${nearAnalysis.percival.met ? 'text-green-300' : 'text-red-300'}`}>
                      {nearAnalysis.percival.message}
                    </div>
                  </div>
                </div>
              </div>
            ) : <div />}
          </div>
        )}
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

const SectionHeader = ({ icon: Icon, title, subtitle, children, hideIcon, titleClassName }: { icon: any, title: string, subtitle?: string, children?: React.ReactNode, hideIcon?: boolean, titleClassName?: string }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-gray-200 pb-4">
    <div className="flex items-center gap-3">
      {!hideIcon && (
        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
          <Icon size={24} />
        </div>
      )}
      <div>
        <h2 className={titleClassName || "text-xl font-bold text-gray-900"}>{title}</h2>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

const DataTable = ({ 
  section, 
  phoriaValue, 
  phoriaType, 
  bi, 
  bo, 
  norms,
  onInputChange,
  onKeyDown
}: { 
  section: 'distance' | 'near', 
  phoriaValue: string, 
  phoriaType: 'exo' | 'eso' | 'ortho',
  bi: PrismData,
  bo: PrismData,
  norms: { bi: PrismData, bo: PrismData },
  onInputChange: (section: 'distance' | 'near', field: string, value: string, subField?: keyof PrismData) => void,
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, currentId: string) => void
}) => (
  <div className="w-full overflow-hidden border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-100">
          <th className="p-2 text-xs font-black text-gray-900 uppercase tracking-widest text-center border-r border-gray-100 w-[100px]">斜位</th>
          <th className="p-2 text-xs font-black text-gray-900 uppercase tracking-widest text-center border-r border-gray-100 w-[60px]">基底</th>
          <th className="p-2 text-xs font-black text-gray-900 uppercase tracking-widest text-center border-r border-gray-100">模糊</th>
          <th className="p-2 text-xs font-black text-gray-900 uppercase tracking-widest text-center border-r border-gray-100">破裂</th>
          <th className="p-2 text-xs font-black text-gray-900 uppercase tracking-widest text-center">恢復</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-gray-50">
          <td rowSpan={2} className="p-3 border-r border-gray-100 bg-white align-middle">
            <div className="flex flex-col gap-1.5 items-center">
              <div className="relative w-full">
                <input
                  id={`${section}-phoria`}
                  type="text"
                  value={phoriaValue}
                  onChange={(e) => onInputChange(section, 'phoriaValue', e.target.value)}
                  onKeyDown={(e) => onKeyDown(e, `${section}-phoria`)}
                  placeholder="0"
                  className="w-full px-2 py-1.5 bg-gray-50/50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center font-mono text-sm placeholder:text-gray-400"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[10px]">Δ</span>
              </div>
              <div className="flex bg-gray-50 p-0.5 rounded-lg border border-gray-100 w-full overflow-hidden">
                <button
                  onClick={() => {
                    if (phoriaValue !== '0' && phoriaValue !== '') {
                      const nextType = phoriaType === 'exo' ? 'eso' : 'exo';
                      onInputChange(section, 'phoriaType', nextType);
                    }
                  }}
                  className={`flex-1 py-1 text-[10px] font-black rounded transition-all ${
                    phoriaValue === '0' || phoriaValue === ''
                      ? 'bg-white text-green-700 shadow-sm cursor-default'
                      : 'bg-white text-blue-700 shadow-sm hover:bg-blue-50 active:scale-95'
                  }`}
                >
                  {phoriaValue === '0' || phoriaValue === '' ? '正位' : (phoriaType === 'exo' ? 'BI' : 'BO')}
                </button>
              </div>
            </div>
          </td>
          <td className="p-2 text-center border-r border-gray-100 bg-blue-50/10 font-black text-xs text-blue-700">BI</td>
          {(['blur', 'break', 'recovery'] as const).map((sub) => {
            const isDistBIBlur = section === 'distance' && sub === 'blur';
            return (
              <td key={sub} className="p-1 border-r border-gray-100 last:border-r-0">
                <input
                  id={`${section}-bi-${sub}`}
                  type="text"
                  value={isDistBIBlur ? 'X' : bi[sub]}
                  readOnly={isDistBIBlur}
                  onChange={(e) => !isDistBIBlur && onInputChange(section, 'bi', e.target.value, sub)}
                  onKeyDown={(e) => !isDistBIBlur && onKeyDown(e, `${section}-bi-${sub}`)}
                  placeholder={norms.bi[sub]}
                  className={`w-full py-3 bg-transparent text-center font-mono text-sm outline-none transition-colors placeholder:text-gray-400 ${
                    isDistBIBlur 
                      ? 'text-gray-400 cursor-not-allowed font-bold' 
                      : 'hover:bg-gray-50/50 focus:bg-blue-50/30 focus:ring-0'
                  }`}
                />
              </td>
            );
          })}
        </tr>
        <tr>
          <td className="p-2 text-center border-r border-gray-100 bg-indigo-50/10 font-black text-xs text-indigo-700">BO</td>
          {(['blur', 'break', 'recovery'] as const).map((sub) => (
            <td key={sub} className="p-1 border-r border-gray-100 last:border-r-0">
              <input
                id={`${section}-bo-${sub}`}
                type="text"
                value={bo[sub]}
                onChange={(e) => onInputChange(section, 'bo', e.target.value, sub)}
                onKeyDown={(e) => onKeyDown(e, `${section}-bo-${sub}`)}
                placeholder={norms.bo[sub]}
                className="w-full py-3 bg-transparent hover:bg-gray-50/50 focus:bg-indigo-50/30 text-center font-mono text-sm focus:ring-0 outline-none transition-colors placeholder:text-gray-400"
              />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  </div>
);

export default function App() {
  const [data, setData] = useState<VisionData>(getInitialData());
  const [mode, setMode] = useState<'simple' | 'professional' | 'logic'>('simple');
  const [aaInputMode, setAaInputMode] = useState<'push-up' | 'push-up-add' | 'direct'>('push-up');

  // Trigger recalculation when accommodation mode switches
  useEffect(() => {
    setData(prev => {
      const newData = { ...prev };
      
      if (aaInputMode === 'push-up' || aaInputMode === 'push-up-add') {
        const cm = parseFloat(prev.blurPoint);
        const add = aaInputMode === 'push-up-add' ? (parseFloat(prev.addValue) || 0) : 0;
        if (!isNaN(cm) && cm > 0) {
          newData.aa = (100 / cm - add).toFixed(2);
        }
      } else if (aaInputMode === 'direct') {
        const d = parseFloat(prev.aa);
        if (!isNaN(d) && d > 0) {
          newData.blurPoint = (100 / d).toFixed(1);
        }
      }
      return newData;
    });
  }, [aaInputMode]);

  const handleInputChange = (
    section: 'distance' | 'near' | 'general',
    field: string,
    value: string,
    subField?: keyof PrismData
  ) => {
    // Only filter if it's a numeric field. Type fields (exo/eso, plus/minus) should not be filtered.
    const isTypeField = field.toLowerCase().includes('type') || field === 'birthDate';
    const filteredValue = isTypeField ? value : value.replace(/－/g, '-').replace(/[^\d.-]/g, '');

    setData((prev) => {
      if (section === 'general') {
        let finalValue = filteredValue;
        
        // Auto-format FCC, AA, ADD: "200" -> "2.00"
        if (field === 'fccValue' || field === 'aa' || field === 'addValue') {
          const digits = filteredValue.replace(/[^\d]/g, '');
          if (digits.length === 3) {
            finalValue = (parseInt(digits) / 100).toFixed(2);
          }
        }

        const newData = { ...prev, [field]: finalValue };
        
        // Auto-calculate AA from Blur Point (Push-up methods)
        if ((field === 'blurPoint' || field === 'addValue') && (aaInputMode === 'push-up' || aaInputMode === 'push-up-add')) {
          const cm = parseFloat(field === 'blurPoint' ? finalValue : prev.blurPoint);
          const add = aaInputMode === 'push-up-add' 
            ? (parseFloat(field === 'addValue' ? finalValue : prev.addValue) || 0)
            : 0;
            
          if (!isNaN(cm) && cm > 0) {
            newData.aa = (100 / cm - add).toFixed(2);
          } else if (field === 'blurPoint' && finalValue === '') {
            newData.aa = '';
          }
        }
        
        // Auto-calculate Blur Point from AA (Direct method)
        if (field === 'aa' && aaInputMode === 'direct') {
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
        'general-birthdate',
        'general-pd',
        'dist-phoria',
        'dist-bi-blur', 'dist-bi-break', 'dist-bi-recovery',
        'dist-bo-blur', 'dist-bo-break', 'dist-bo-recovery',
        'near-phoria',
        'near-phoria-plus1',
        'near-bi-blur', 'near-bi-break', 'near-bi-recovery',
        'near-bo-blur', 'near-bo-break', 'near-bo-recovery',
        'near-add',
        'near-blur-point',
        'near-aa',
        'near-fcc',
        'near-nra',
        'near-pra'
      ];
      const currentIndex = inputIds.indexOf(currentId);
      if (currentIndex !== -1) {
        for (let i = currentIndex + 1; i < inputIds.length; i++) {
          const nextInput = document.getElementById(inputIds[i]);
          if (nextInput && nextInput.offsetParent !== null) { // offsetParent is null if hidden
            nextInput.focus();
            // @ts-ignore
            nextInput.select();
            break;
          }
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-12 px-2 sm:px-6 lg:px-8 font-sans relative">
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
                checked={mode === 'logic'}
                onChange={() => setMode('logic')}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className={`text-sm font-medium transition-colors ${mode === 'logic' ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'}`}>
                邏輯模式
              </span>
            </label>
          </div>
        </div>

        {/* Main Content (Simple or Professional) */}
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

            {/* General Info Section - Hidden in Logic mode as requested */}
            {mode !== 'logic' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
                <SectionHeader 
                  icon={Activity} 
                  title="基本資料" 
                  subtitle="受檢者基礎數據"
                  hideIcon={true}
                />
                <div className="flex flex-col lg:flex-row items-center lg:items-center gap-8">
                  <div className="flex flex-wrap items-start gap-10 flex-1">
                    {/* Birth Date Group */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <label 
                          className="text-[11px] font-black text-gray-900 tracking-widest uppercase"
                          htmlFor="general-birthdate"
                        >
                          年齡
                        </label>
                        {data.birthDate && (
                          <span className="text-[10px] font-black text-blue-600">
                            ({calculateAge(data.birthDate)} 歲)
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          id="general-birthdate"
                          type="month"
                          value={data.birthDate}
                          onChange={(e) => handleInputChange('general', 'birthDate', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, 'general-birthdate')}
                          className="w-32 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all font-mono text-sm"
                        />
                      </div>
                    </div>

                    {/* PD Group */}
                    <div className="flex flex-col gap-2">
                      <label 
                        className="text-[11px] font-black text-gray-900 tracking-widest uppercase"
                        htmlFor="general-pd"
                      >
                        瞳距
                      </label>
                      <div className="relative">
                        <input
                          id="general-pd"
                          type="text"
                          value={data.pd}
                          onChange={(e) => handleInputChange('general', 'pd', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, 'general-pd')}
                          placeholder="64"
                          className="w-20 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all font-mono text-sm placeholder:text-gray-400"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] font-bold">mm</span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden lg:block shrink-0 text-right">
                    <div className="inline-block text-[10px] font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-full uppercase tracking-widest">
                      臨床診斷輔助系統
                    </div>
                  </div>
                </div>
              </div>
            )}

        {mode === 'logic' ? (
          <div className="space-y-4 animate-in fade-in duration-500 max-w-4xl mx-auto">
            {/* Accommodation Logic Matrix */}
            <div className="bg-white text-gray-900 rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center text-gray-900 bg-white">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-blue-600">調節系統判定路徑</h3>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-200">
                      <th className="p-2 text-left text-[9px] font-black text-blue-600 uppercase tracking-wider border-r border-gray-100" colSpan={4}>★ 優先判定 (Priority Rule)</th>
                    </tr>
                    <tr className="bg-yellow-50/20 border-b border-gray-200">
                      <td className="p-3 border-r border-gray-100 font-bold text-xs text-yellow-700">調節不靈敏 (AF)</td>
                      <td className="p-3 border-r border-gray-100 text-xs text-gray-600 italic" colSpan={2}>
                        獨立判定：不考慮 FCC 與 AA。只要滿足：
                        <span className="font-bold ml-2">NRA &lt; +1.50 且 PRA &gt; -1.75</span>
                      </td>
                      <td className="p-3 font-black text-yellow-600 bg-yellow-50/10 text-xs">調節不靈敏 (AF)</td>
                    </tr>
                    <tr className="bg-white border-b border-gray-200 text-gray-400">
                      <th className="p-2 text-left text-[9px] font-black uppercase tracking-wider border-r border-gray-100 w-1/5">1. FCC 結果</th>
                      <th className="p-2 text-left text-[9px] font-black uppercase tracking-wider border-r border-gray-100 w-1/5">2. AA 狀態</th>
                      <th className="p-2 text-left text-[9px] font-black uppercase tracking-wider border-r border-gray-100 w-1/4">3. 驗證指標</th>
                      <th className="p-2 text-left text-[9px] font-black uppercase tracking-wider w-1/4">最終診斷</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {/* Branch: FCC > 0.75 */}
                    <tr className="border-b border-gray-100">
                      <td rowSpan={2} className="p-3 border-r border-gray-100 align-top">
                        <div className="font-bold text-red-600 text-xs">FCC {`>`} 0.75</div>
                      </td>
                      <td className="p-3 border-r border-gray-100 border-b border-gray-50">
                        <div className="font-bold text-gray-700 text-xs">AA 低</div>
                      </td>
                      <td className="p-3 border-r border-gray-100 border-b border-gray-50 text-gray-500 italic text-xs">
                        調節幅度不足
                      </td>
                      <td className="p-3 font-black text-red-600 bg-red-50/10 text-xs">調節不足 (AI)</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-3 border-r border-gray-100">
                        <div className="font-bold text-gray-700 text-xs">AA 正常</div>
                      </td>
                      <td className="p-3 border-r border-gray-100 text-gray-500 text-xs">
                        PRA {`>`} -1.25 ?
                      </td>
                      <td className="p-3 font-black text-xs">
                        <div className="text-red-500">YES → 調節不足</div>
                        <div className="text-orange-500">NO → 調節遲緩</div>
                      </td>
                    </tr>

                    {/* Branch: FCC < 0.00 */}
                    <tr className="border-b border-gray-100">
                      <td rowSpan={2} className="p-3 border-r border-gray-100 align-top">
                        <div className="font-bold text-indigo-600 text-xs">FCC {`<`} 0.00</div>
                      </td>
                      <td className="p-3 border-r border-gray-100 border-b border-gray-50">
                        <div className="font-bold text-gray-700 text-xs">AA 低</div>
                      </td>
                      <td className="p-3 border-r border-gray-100 border-b border-gray-50 text-gray-500 italic text-xs">
                        AA 低且 FCC 超前
                      </td>
                      <td className="p-3 font-black text-purple-600 bg-purple-50/10 text-xs">調節力不足且過度使用(痙攣)</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-3 border-r border-gray-100">
                        <div className="font-bold text-gray-700 text-xs">AA 正常</div>
                      </td>
                      <td className="p-3 border-r border-gray-100 text-gray-500 text-xs">
                        NRA {`<`} +1.50 ?
                      </td>
                      <td className="p-3 font-black text-emerald-600 bg-emerald-50/10 text-xs">調節過多 (AcE)</td>
                    </tr>

                    {/* Branch: FCC Normal */}
                    <tr className="border-b border-gray-100">
                      <td rowSpan={2} className="p-3 border-r border-gray-100 align-top text-gray-900">
                        <div className="font-bold text-blue-600 text-xs text-center bg-blue-50/10 p-1 rounded">FCC 正常</div>
                      </td>
                      <td className="p-3 border-r border-gray-100 border-b border-gray-50">
                        <div className="font-bold text-gray-700 text-xs">AA 正常</div>
                      </td>
                      <td className="p-3 border-r border-gray-100 border-b border-gray-50 text-gray-500 text-xs">
                        NRA & PRA 正常
                      </td>
                      <td className="p-3 font-black text-emerald-600 bg-emerald-50/5 text-xs">調節系統正常</td>
                    </tr>
                    <tr>
                      <td className="p-3 border-r border-gray-100 text-gray-900">
                        <div className="font-bold text-gray-700 text-xs">AA 正常或低</div>
                      </td>
                      <td className="p-3 border-r border-gray-100 text-gray-500 text-xs">
                        PRA 偏低 (&gt; -1.25)
                      </td>
                      <td className="p-3 font-black text-orange-500 bg-orange-50/10 text-xs">潛在調節不足</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vergence Logic Matrix */}
            <div className="bg-white text-gray-900 rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center bg-white">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600">聚散功能判定路徑</h3>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-gray-200">
                      <th className="p-2 text-left text-[9px] font-black text-gray-400 uppercase tracking-wider border-r border-gray-100 w-1/4">1. 斜位異常區域</th>
                      <th className="p-2 text-left text-[9px] font-black text-gray-400 uppercase tracking-wider border-r border-gray-100 w-1/4">2. AC/A 比值</th>
                      <th className="p-2 text-left text-[9px] font-black text-gray-400 uppercase tracking-wider border-r border-gray-100 w-1/4">3. 數據對比</th>
                      <th className="p-2 text-left text-[9px] font-black text-gray-400 uppercase tracking-wider w-1/4">最終診斷</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {/* Near Exo Group */}
                    <tr className="border-b border-gray-100">
                      <td rowSpan={3} className="p-4 border-r border-gray-100 align-top">
                        <div className="font-bold text-orange-600 text-sm">近方外斜超出</div>
                        <div className="text-gray-400 text-[9px] mt-0.5">{`>`} 6Δ Exo</div>
                      </td>
                      <td className="p-4 border-r border-gray-100 border-b border-gray-50">
                        <div className="font-bold text-gray-700">Low AC/A</div>
                      </td>
                      <td className="p-4 border-r border-gray-100 border-b border-gray-50 text-gray-500">
                        近方外斜 {`>`} 遠方外斜
                      </td>
                      <td className="p-4 font-black text-blue-600 bg-blue-50/10">集合不足 (CI)</td>
                    </tr>
                    <tr className="border-b border-gray-50">
                      <td className="p-4 border-r border-gray-100 border-b border-gray-50">
                        <div className="font-bold text-gray-700">Normal AC/A</div>
                      </td>
                      <td className="p-4 border-r border-gray-100 border-b border-gray-50 text-gray-500">
                        AA 低於最小值
                      </td>
                      <td className="p-4 font-black text-blue-400 bg-blue-50/5">假性集合不足</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-4 border-r border-gray-100">
                        <div className="font-bold text-gray-700">Normal AC/A</div>
                      </td>
                      <td className="p-4 border-r border-gray-100 text-gray-500">
                        遠近外斜差異 {`<`} 4Δ
                      </td>
                      <td className="p-4 font-black">單純型外斜</td>
                    </tr>

                    {/* Near Eso Group */}
                    <tr className="border-b border-gray-100">
                      <td rowSpan={2} className="p-4 border-r border-gray-100 align-top">
                        <div className="font-bold text-blue-600 text-sm">近方內斜超出</div>
                        <div className="text-gray-400 text-[9px] mt-0.5">{`>`} 0Δ Eso</div>
                      </td>
                      <td className="p-4 border-r border-gray-100 border-b border-gray-50">
                        <div className="font-bold text-gray-700">High AC/A</div>
                      </td>
                      <td className="p-4 border-r border-gray-100 border-b border-gray-50 text-gray-500">
                        近方內斜 {`>`} 遠方內斜
                      </td>
                      <td className="p-4 font-black text-indigo-600 bg-indigo-50/10">集合過度 (CE)</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-4 border-r border-gray-100">
                        <div className="font-bold text-gray-700">Normal AC/A</div>
                      </td>
                      <td className="p-4 border-r border-gray-100 text-gray-500">
                        遠近內斜差異 {`<`} 4Δ
                      </td>
                      <td className="p-4 font-black">單純型內斜</td>
                    </tr>

                    {/* Distance Exo Group (New: DE) */}
                    <tr className="border-b border-gray-100">
                      <td rowSpan={1} className="p-4 border-r border-gray-100 align-top">
                        <div className="font-bold text-orange-700 text-sm">遠方外斜顯著</div>
                        <div className="text-gray-400 text-[9px] mt-0.5">{`>`} 1Δ Exo</div>
                      </td>
                      <td className="p-4 border-r border-gray-100">
                        <div className="font-bold text-gray-700">High AC/A</div>
                      </td>
                      <td className="p-4 border-r border-gray-100 text-gray-500">
                        遠方外斜 {`>`} 近方外斜
                      </td>
                      <td className="p-4 font-black text-amber-600 bg-amber-50/10">開散過度 (DE)</td>
                    </tr>

                    {/* Distance Eso Group (New: DI) */}
                    <tr className="border-b border-gray-100">
                      <td rowSpan={1} className="p-4 border-r border-gray-100 align-top">
                        <div className="font-bold text-blue-800 text-sm">遠方內斜顯著</div>
                        <div className="text-gray-400 text-[9px] mt-0.5">{`>`} 1Δ Eso</div>
                      </td>
                      <td className="p-4 border-r border-gray-100">
                        <div className="font-bold text-gray-700">Low AC/A</div>
                      </td>
                      <td className="p-4 border-r border-gray-100 text-gray-500">
                        遠方內斜 {`>`} 近方內斜
                      </td>
                      <td className="p-4 font-black text-cyan-700 bg-cyan-50/10">開散不足 (DI)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Clinical Symptoms & Management Section (Split into Distance and Near) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Distance Related */}
              <div className="bg-white text-gray-900 rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-blue-50/50 flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-blue-700">遠方功能異常 (Distance Related)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <tbody className="text-[11px]">
                      <tr className="border-b border-gray-50">
                        <td className="p-3 font-bold text-cyan-700 bg-cyan-50/10 w-1/3">開散不足 (DI)</td>
                        <td className="p-3 text-gray-500">
                          <div className="font-bold text-gray-700 mb-1">症狀：看遠方複視、頭疼</div>
                          <div className="text-cyan-800 font-black">處理：遠距加入 BO 處理</div>
                        </td>
                      </tr>
                      <tr className="border-b border-gray-50">
                        <td className="p-3 font-bold text-amber-600 bg-amber-50/10">開散過度 (DE)</td>
                        <td className="p-3 text-gray-500">
                          <div className="font-bold text-gray-700 mb-1">症狀：看遠方複視和視覺疲勞</div>
                          <div className="text-amber-700 font-black">處理：遠距加入 BI 處理或加入負度數</div>
                        </td>
                      </tr>
                      <tr className="border-b border-gray-50">
                        <td className="p-3 font-bold text-orange-600 bg-orange-50/10">單純型外斜位</td>
                        <td className="p-3 text-gray-500">
                          <div className="font-bold text-gray-700 mb-1">症狀：視覺疲勞、遠近複視</div>
                          <div className="text-orange-700 font-black">處理：加入 BI 處理或負度數</div>
                        </td>
                      </tr>
                      <tr className="border-b border-gray-50">
                        <td className="p-3 font-bold text-blue-800 bg-blue-50/10">單純型內斜位</td>
                        <td className="p-3 text-gray-500">
                          <div className="font-bold text-gray-700 mb-1">症狀：近距工作易疲、偶爾複視</div>
                          <div className="text-blue-900 font-black">處理：加入 BO 處理</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column: Near Related */}
              <div className="bg-white text-gray-900 rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-emerald-50/50 flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-emerald-700">近方功能異常 (Near Related)</h3>
                </div>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <tbody className="text-[11px]">
                      <tr className="border-b border-gray-50">
                        <td className="p-3 font-bold text-blue-600 bg-blue-50/10 w-1/4">集合不足 (CI)</td>
                        <td className="p-3 text-gray-500">
                          <div className="font-bold text-gray-700 mb-1">症狀：看近複視模糊、聚焦困難、酸脹、周圍疼痛、無法集中</div>
                          <div className="text-blue-700 font-black">處理：屈光矯正、正度數、BI、推進訓練 (Brock線)</div>
                        </td>
                      </tr>
                      <tr className="border-b border-gray-50">
                        <td className="p-3 font-bold text-blue-400 bg-blue-50/5">假性集合不足</td>
                        <td className="p-3 text-gray-500">
                          <div className="font-bold text-gray-700 mb-1">症狀：閱讀疲勞 (主因是調節不足)</div>
                          <div className="text-blue-500 font-black">處理：屈光矯正、附加正度數</div>
                        </td>
                      </tr>
                      <tr className="border-b border-gray-50">
                        <td className="p-3 font-bold text-indigo-600 bg-indigo-50/10">集合過度 (CE)</td>
                        <td className="p-3 text-gray-500">
                          <div className="font-bold text-gray-700 mb-1">症狀：複視模糊(遠近均可)、頭部傾斜、晚間眼眶疼痛、想閉眼</div>
                          <div className="text-indigo-700 font-black">處理：屈光矯正、加入正度數、近用 BO</div>
                        </td>
                      </tr>
                      <tr className="border-b border-gray-50">
                        <td className="p-3 font-bold text-red-600 bg-red-50/10">調節不足 (AI)</td>
                        <td className="p-3 text-gray-500">
                          <div className="font-bold text-gray-700 mb-1">症狀：近工作疲勞想睡、看遠近易模糊、字體移動感、眼乾畏光</div>
                          <div className="text-red-700 font-black">處理：屈光矯正、正度數、推進訓練 (Brock線)</div>
                        </td>
                      </tr>
                      <tr className="border-b border-gray-50">
                        <td className="p-3 font-bold text-orange-600 bg-orange-50/10">調節遲緩 (AE)</td>
                        <td className="p-3 text-gray-500">
                          <div className="font-bold text-gray-700 mb-1">症狀：近方模糊 (對焦慢)、閱讀疲勞</div>
                          <div className="text-orange-700 font-black">處理：屈光矯正、正度數或休息</div>
                        </td>
                      </tr>
                      <tr className="border-b border-gray-50">
                        <td className="p-3 font-bold text-yellow-600 bg-yellow-50/10">調節不靈敏 (AF)</td>
                        <td className="p-3 text-gray-500">
                          <div className="font-bold text-gray-700 mb-1">症狀：遠近切換困難、注意力下降、嗜睡、眼脹、字體移動</div>
                          <div className="text-yellow-700 font-black">處理：屈光矯正、反轉鏡訓練、遠近字母法</div>
                        </td>
                      </tr>
                      <tr className="border-b border-gray-50">
                        <td className="p-3 font-bold text-indigo-600 bg-indigo-50/10">調節過多 (AcE)</td>
                        <td className="p-3 text-gray-500">
                          <div className="font-bold text-gray-700 mb-1">症狀：畏光、遠近均模糊(晚上明顯)、眼脹、切換困難</div>
                          <div className="text-indigo-700 font-black">處理：屈光矯正、加入正度數</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>


            {/* Note Section */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-start gap-4">
              <RotateCcw className="text-gray-400 shrink-0 mt-1" size={16} />
              <div className="space-y-1">
                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Logic Engine Note</h4>
                <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                  本系統邏輯基於《Clinical Management of Binocular Vision》。當數據不完整時，系統將採用優先級推斷（例如：使用 PRA 值來校驗 AA 的真實性）。所有判定最終應由專業視光師/醫師簽署確認。
                </p>
              </div>
            </div>
          </div>
        ) : mode === 'simple' ? (
          <div className="space-y-8">
            {/* Simple Mode: Phoria Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <SectionHeader 
                icon={Activity} 
                title="斜位數據" 
                subtitle="遠方與近方斜位"
                hideIcon={true}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {/* Distance Phoria */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap w-20">
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
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono text-sm placeholder:text-gray-400"
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

                {/* Near Phoria */}
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
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono text-sm placeholder:text-gray-400"
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
              </div>
            </div>

            {/* Simple Mode: Accommodation Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <SectionHeader 
                icon={Eye} 
                title="調節系統" 
                subtitle=""
                titleClassName="text-2xl font-black text-gray-900"
                hideIcon={true}
              >
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
                    onClick={() => setAaInputMode('push-up-add')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      aaInputMode === 'push-up-add'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    加入 ADD 推進法
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
              </SectionHeader>

              <div className="space-y-6">
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
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-400"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">D</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-400"
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
                          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-400"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">D</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-gray-500 font-medium">加入 ADD</span>
                    <div className="relative">
                      <input
                        id="near-add"
                        type="text"
                        value={data.addValue}
                        onChange={(e) => handleInputChange('general', 'addValue', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, 'near-add')}
                        placeholder="0.00"
                        disabled={aaInputMode !== 'push-up-add'}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-400 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">D</span>
                    </div>
                  </div>
                  {aaInputMode === 'push-up' || aaInputMode === 'push-up-add' ? (
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
                          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-400"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">cm</span>
                      </div>
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
                          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-400"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">D</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="pt-2 flex justify-end items-center">
                  <p className="text-sm font-bold text-blue-600">
                    最終 AA: {data.aa || '0'} D
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Distance Section (6m) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <SectionHeader 
                icon={Ruler} 
                title="聚散系統" 
                subtitle="遠方 (6m) 與 近方 (40cm)"
                hideIcon={true}
                titleClassName="text-2xl font-black text-gray-900"
              />
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-6">
                {/* Distance Data */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
                    <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">遠方數據 (6m)</h3>
                  </div>
                  <DataTable 
                    section="distance"
                    phoriaValue={data.distance.phoriaValue}
                    phoriaType={data.distance.phoriaType}
                    bi={data.distance.bi}
                    bo={data.distance.bo}
                    norms={{ 
                      bi: { blur: 'x', break: '7', recovery: '4' },
                      bo: { blur: '9', break: '19', recovery: '10' }
                    }}
                    onInputChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                  />
                </div>

                {/* Near Data Column */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-4 w-1 bg-emerald-500 rounded-full"></div>
                    <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">近方數據 (40cm)</h3>
                  </div>
                  <DataTable 
                    section="near"
                    phoriaValue={data.near.phoriaValue}
                    phoriaType={data.near.phoriaType}
                    bi={data.near.bi}
                    bo={data.near.bo}
                    norms={{ 
                      bi: { blur: '13', break: '21', recovery: '13' },
                      bo: { blur: '17', break: '21', recovery: '11' }
                    }}
                    onInputChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                  />
                  {/* +1.00 Phoria - Moved here into near column */}
                  <div className="flex items-center gap-4 p-4 bg-gray-50/50 rounded-xl border border-gray-100 mt-4">
                    <div className="flex items-center shrink-0">
                      <span className="text-xs font-black text-gray-700 uppercase tracking-widest w-24">
                        +1.00 斜位
                      </span>
                    </div>
                    <div className="flex gap-2 flex-1 max-w-[220px]">
                      <div className="relative w-24">
                        <input
                          id="near-phoria-plus1"
                          type="text"
                          value={data.near.phoriaPlus1Value}
                          onChange={(e) => handleInputChange('near', 'phoriaPlus1Value', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, 'near-phoria-plus1')}
                          placeholder="0"
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono text-sm"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[10px]">Δ</span>
                      </div>
                      <div className="flex bg-gray-50 p-0.5 rounded-lg border border-gray-100 flex-1">
                        <button
                          onClick={() => {
                            if (data.near.phoriaPlus1Value !== '0' && data.near.phoriaPlus1Value !== '') {
                              const nextType = data.near.phoriaPlus1Type === 'exo' ? 'eso' : 'exo';
                              handleInputChange('near', 'phoriaPlus1Type', nextType);
                            }
                          }}
                          className={`flex-1 py-1 text-[9px] font-black rounded transition-all ${
                            data.near.phoriaPlus1Value === '0' || data.near.phoriaPlus1Value === ''
                              ? 'bg-white text-green-600 shadow-sm cursor-default'
                              : 'bg-white text-blue-600 shadow-sm hover:bg-blue-50 active:scale-95'
                          }`}
                        >
                          {data.near.phoriaPlus1Value === '0' || data.near.phoriaPlus1Value === '' ? '正位' : (data.near.phoriaPlus1Type === 'exo' ? 'BI' : 'BO')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <div className="space-y-6">
                <div className="pt-2">
                <SectionHeader 
                  icon={Eye} 
                  title="調節系統" 
                  subtitle=""
                  titleClassName="text-2xl font-black text-gray-900"
                  hideIcon={true}
                >
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
                        onClick={() => setAaInputMode('push-up-add')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                          aaInputMode === 'push-up-add'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        加入 ADD 推進法
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
                  </SectionHeader>
                  
                  <div className="space-y-6">
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
                            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-400"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">D</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
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
                              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-400"
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
                              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-400"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">D</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="space-y-1">
                        <span className="text-xs text-gray-500 font-medium">加入 ADD</span>
                        <div className="relative">
                        <input
                          id="near-add"
                          type="text"
                          value={data.addValue}
                          onChange={(e) => handleInputChange('general', 'addValue', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, 'near-add')}
                          placeholder="0.00"
                          disabled={aaInputMode !== 'push-up-add'}
                          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-400 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                        />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">D</span>
                        </div>
                      </div>
                      {aaInputMode === 'push-up' || aaInputMode === 'push-up-add' ? (
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
                              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-400"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">cm</span>
                          </div>
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
                              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-400"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">D</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="pt-2 flex justify-end items-center">
                    <p className="text-sm font-bold text-blue-600">
                      最終 AA: {data.aa || '0'} D
                    </p>
                  </div>
                </div>

                <ComprehensiveAnalysis data={data} />
              </div>
            </div>
          </div>
        )}

        {mode === 'simple' && (
          <div className="mt-8">
            <ComprehensiveAnalysis data={data} />
          </div>
        )}
      </>

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
