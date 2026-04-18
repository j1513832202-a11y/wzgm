// @ts-ignore;
import React, { useState, useEffect } from 'react';
// @ts-ignore;
import { Copy } from 'lucide-react';
// @ts-ignore;
import { useToast } from '@/components/ui';

export default function BlankName(props) {
  const {
    $w
  } = props;
  const {
    toast
  } = useToast();
  const [generatedName, setGeneratedName] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(new Set());
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

  // 从空白代码库中随机组合6个代码
  const generateBlankName = async () => {
    if (!cardCode) {
      toast({
        title: '卡密无效',
        description: '请重新输入卡密',
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

      // 获取所有空白代码
      const codesResult = await db.collection('rename_code_lib').limit(100).get();
      const codes = codesResult.data.map(item => item.code_content).filter(code => code);
      if (codes.length === 0) {
        toast({
          title: '暂无空白代码',
          description: '请先添加空白代码',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // 生成一个6个空白代码的组合
      let blankName = '';
      let attempts = 0;
      const maxAttempts = 1000; // 防止无限循环
      let success = false;
      while (!success && attempts < maxAttempts) {
        attempts++;
        blankName = '';

        // 随机生成6个空白代码
        for (let i = 0; i < 6; i++) {
          const randomCode = codes[Math.floor(Math.random() * codes.length)];
          blankName += randomCode;
        }

        // 检查是否在历史记录中
        if (!history.has(blankName)) {
          success = true;
          // 更新历史记录
          const newHistory = new Set(history);
          newHistory.add(blankName);
          setHistory(newHistory);
        }
      }
      if (success) {
        setGeneratedName(blankName);

        // 扣减卡密次数
        await db.collection('card_code_manage').where({
          card_code: cardCode
        }).update({
          remaining_times: remainingTimes - 1
        });

        // 更新本地剩余次数
        setRemainingTimes(remainingTimes - 1);

        // 记录用户访问
        await db.collection('user_access_record').add({
          card_code: cardCode,
          access_type: 'blank_name',
          access_time: new Date().toISOString(),
          access_ip: $w.utils.getUserIP ? $w.utils.getUserIP() : 'unknown'
        });
        toast({
          title: '生成成功',
          description: `剩余生成次数：${remainingTimes - 1}`
        });
      } else {
        toast({
          title: '生成失败',
          description: '无法生成更多不重复的空白名，请刷新页面重试',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('生成空白名失败', error);
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
  return <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* 页面标题和装饰 */}
        <div className="text-center">
          <div className="inline-block px-4 py-2 bg-blue-100 rounded-full mb-4">
            <span className="text-blue-600 text-sm font-medium">✨ 空白名生成器</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            生成空白名
          </h1>
        </div>
        
        {/* 卡密信息卡片 */}
        {cardCode && <div className="bg-white p-5 rounded-2xl shadow-lg border border-blue-100">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-500 font-medium">当前卡密</div>
              <div className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-xs font-semibold">
                {remainingTimes}/20 次
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-base font-bold text-blue-800 break-all">
                {cardCode}
              </div>
            </div>
          </div>}

        {/* 生成按钮区域 */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-purple-100">
          <button onClick={generateBlankName} disabled={loading || remainingTimes <= 0} className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${loading || remainingTimes <= 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'}`}>
            {loading ? <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                生成中...
              </span> : '生成空白名'}
          </button>

          {/* 生成结果展示 */}
          {generatedName && <div className="mt-6 p-5 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border-2 border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <div className="text-sm text-gray-600 font-semibold">生成结果</div>
              </div>
              <div className="bg-white p-4 rounded-lg mb-3">
                <div className="text-2xl font-bold text-blue-700 break-all tracking-wider">
                  {generatedName}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                <span>字符数：{generatedName.length}</span>
                <span className="text-green-600 font-medium">✓ 已生成</span>
              </div>
              <button onClick={handleCopy} className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2">
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