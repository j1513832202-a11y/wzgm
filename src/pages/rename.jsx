// @ts-ignore;
import React, { useState, useEffect } from 'react';
// @ts-ignore;
import { useToast } from '@/components/ui';
// @ts-ignore;
import { Copy } from 'lucide-react';

export default function Rename(props) {
  const {
    toast
  } = useToast();
  const [name, setName] = useState('');
  const [generatedName, setGeneratedName] = useState('');
  const [loading, setLoading] = useState(false);
  const [cardCode, setCardCode] = useState('');
  const [remainingTimes, setRemainingTimes] = useState(0);
  useEffect(() => {
    // 从URL参数获取卡密
    const cardCodeParam = props.$w.page.dataset.params.cardCode || '';
    setCardCode(cardCodeParam);
    if (cardCodeParam) {
      // 获取卡密剩余次数
      loadCardInfo(cardCodeParam);
    }
  }, [props.$w.page.dataset.params.cardCode]);

  // 加载卡密信息
  const loadCardInfo = async code => {
    try {
      const tcb = await $w.cloud.getCloudInstance();
      const db = tcb.database();
      const result = await db.collection('card_code_manage').where({
        card_code: code
      }).get();
      if (result.data && result.data.length > 0) {
        setRemainingTimes(result.data[0].remaining_times || 0);
      }
    } catch (error) {
      console.error('加载卡密信息失败', error);
    }
  };
  const handleGenerate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({
        title: '请输入名字',
        variant: 'destructive'
      });
      return;
    }
    if (trimmedName.length < 1 || trimmedName.length > 5) {
      toast({
        title: '名字长度应为1-5个字符',
        variant: 'destructive'
      });
      return;
    }

    // 检查卡密剩余次数
    if (remainingTimes <= 0) {
      toast({
        title: '生成次数已用完',
        description: '该卡密的20次生成次数已用完',
        variant: 'destructive'
      });
      return;
    }
    setLoading(true);
    try {
      const tcb = await $w.cloud.getCloudInstance();
      const db = tcb.database();
      const result = await db.collection('rename_code_lib').limit(100).get();

      // 数据库返回的数据是平铺结构，直接提取 code_content
      const flattenedCodes = [];
      (result.data || []).forEach(doc => {
        if (doc.code_content) {
          flattenedCodes.push(doc.code_content);
        }
      });
      const neededCount = 6 - trimmedName.length;

      // 生成需要插入的空白代码列表
      let randomCodes = [];
      if (flattenedCodes.length === 0) {
        toast({
          title: '暂无可用空白代码',
          description: '请联系管理员添加空白代码',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }
      for (let i = 0; i < neededCount; i++) {
        const randomIndex = Math.floor(Math.random() * flattenedCodes.length);
        randomCodes.push(flattenedCodes[randomIndex] || 'ㅤ');
      }

      // 保持名字字符顺序不变，随机插入空白代码
      const nameChars = trimmedName.split('');
      const insertPositions = []; // 代码插入的位置（0=开头，1=第1个字符后，等等）

      // 可插入的位置数量 = 名字长度 + 1（包括开头和结尾）
      const possiblePositions = nameChars.length + 1;

      // 为每个代码随机选择插入位置
      randomCodes.forEach(code => {
        insertPositions.push(Math.floor(Math.random() * possiblePositions));
      });

      // 按插入位置排序，确保按顺序插入
      const codeInsertions = randomCodes.map((code, index) => ({
        code,
        position: insertPositions[index]
      })).sort((a, b) => a.position - b.position);

      // 构建最终名字：按插入位置将代码插入到名字中
      let finalNameBuilder = '';
      let currentPos = 0;
      codeInsertions.forEach(({
        code,
        position
      }) => {
        // 添加名字中从当前位到插入位之前的字符
        while (currentPos < position && currentPos < nameChars.length) {
          finalNameBuilder += nameChars[currentPos];
          currentPos++;
        }
        // 添加代码
        finalNameBuilder += code;
      });
      // 添加剩余的名字字符
      while (currentPos < nameChars.length) {
        finalNameBuilder += nameChars[currentPos];
        currentPos++;
      }
      const finalGeneratedName = finalNameBuilder;

      // 检查卡密生成次数
      const cardCode = props.$w.page.dataset.params.cardCode || '';
      let finalName = ''; // 提升作用域，确保后续可以访问

      // 卡密在选择页面已验证和标记，这里直接生成
      finalName = finalGeneratedName;
      setGeneratedName(finalName);

      // 扣减卡密次数
      if (cardCode && finalName) {
        await db.collection('card_code_manage').where({
          card_code: cardCode
        }).update({
          remaining_times: remainingTimes - 1
        });

        // 更新本地剩余次数
        setRemainingTimes(remainingTimes - 1);
      }

      // 更新访问记录
      try {
        if (cardCode && finalName) {
          const recordResult = await db.collection('user_access_record').where({
            card_code: cardCode
          }).get();
          if (recordResult.data && recordResult.data.length > 0) {
            const latestRecord = recordResult.data[recordResult.data.length - 1];
            const displayName = `${trimmedName} → ${finalName}`;
            await db.collection('user_access_record').doc(latestRecord._id).update({
              generated_name: displayName
            });
          }
        }
      } catch (recordError) {
        console.error('更新访问记录失败', recordError);
      }
      toast({
        title: '生成成功',
        description: cardCode ? `剩余生成次数：${remainingTimes - 1}` : undefined
      });
    } catch (error) {
      console.error('生成失败', error);
      toast({
        title: '生成失败',
        description: error.message || '网络错误，请重试',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  const handleCopy = () => {
    if (!generatedName) return;
    navigator.clipboard.writeText(generatedName).then(() => {
      toast({
        title: '已复制到剪贴板'
      });
    }).catch(() => {
      toast({
        title: '复制失败',
        variant: 'destructive'
      });
    });
  };
  return <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* 页面标题和装饰 */}
        <div className="text-center">
          <div className="inline-block px-4 py-2 bg-purple-100 rounded-full mb-4">
            <span className="text-purple-600 text-sm font-medium">✨ 重复名生成器</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            生成重复名
          </h1>
          <p className="text-gray-500 text-sm">
            支持特殊名（英文特殊符号）
          </p>
        </div>
        
        {/* 卡密信息卡片 */}
        {cardCode && <div className="bg-white p-5 rounded-2xl shadow-lg border border-purple-100">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-500 font-medium">当前卡密</div>
              <div className="px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-xs font-semibold">
                {remainingTimes}/20 次
              </div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-base font-bold text-purple-800 break-all">
                {cardCode}
              </div>
            </div>
          </div>}

        {/* 生成按钮区域 */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100">
          <div className="mb-4">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="请输入名字（1-5字符）" className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 text-gray-800 font-medium disabled:bg-gray-100 disabled:cursor-not-allowed" disabled={loading} onKeyPress={e => e.key === 'Enter' && handleGenerate()} />
          </div>
          <button onClick={handleGenerate} disabled={loading || remainingTimes <= 0} className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${loading || remainingTimes <= 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'}`}>
            {loading ? <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                生成中...
              </span> : '生成重复名'}
          </button>

          {/* 生成结果展示 */}
          {generatedName && <div className="mt-6 p-5 bg-gradient-to-br from-gray-50 to-purple-50 rounded-xl border-2 border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <div className="text-sm text-gray-600 font-semibold">生成结果</div>
              </div>
              <div className="bg-white p-4 rounded-lg mb-3">
                <div className="text-2xl font-bold text-purple-700 break-all tracking-wider">
                  {generatedName}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                <span>字符数：{generatedName.length}</span>
                <span className="text-green-600 font-medium">✓ 已生成</span>
              </div>
              <button onClick={handleCopy} className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2">
                <Copy size={18} />
                一键复制
              </button>
            </div>}
        </div>

        {/* 使用提示区域 */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-2xl border-2 border-amber-200 shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">💡</span>
            <h3 className="text-lg font-bold text-amber-800">使用提示</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-amber-600 font-bold mt-0.5">1.</span>
              <p className="text-slate-700 text-sm font-semibold">
                改名卡自备
              </p>
            </div>
            
            <div className="flex items-start gap-2">
              <span className="text-amber-600 font-bold mt-0.5">2.</span>
              <div className="flex-1">
                <p className="text-slate-700 text-sm font-semibold mb-2">
                  改名步骤：
                </p>
                <div className="bg-white/70 p-3 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-orange-500">→</span>
                    <span className="text-slate-600 text-xs">生成名字后复制下来</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-500">→</span>
                    <span className="text-slate-600 text-xs">打开王者</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-500">→</span>
                    <span className="text-slate-600 text-xs">打开改名卡</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-500">→</span>
                    <span className="text-slate-600 text-xs">粘贴名字</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-500">→</span>
                    <span className="text-slate-600 text-xs">观察名字是否有符号或者空格</span>
                  </div>
                  <div className="bg-amber-100/70 px-3 py-2 rounded-lg">
                    <p className="text-amber-700 text-xs font-semibold">
                      有的话重新生成，没有的话直接点修改即可
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>;
}