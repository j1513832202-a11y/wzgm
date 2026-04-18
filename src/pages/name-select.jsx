// @ts-ignore;
import React, { useState, useEffect } from 'react';
// @ts-ignore;
import { useToast } from '@/components/ui';
// @ts-ignore;
import { ChevronRight } from 'lucide-react';

export default function NameSelect(props) {
  const {
    toast
  } = useToast();
  const [loading, setLoading] = useState(false);
  const [cardCode, setCardCode] = useState('');
  useEffect(() => {
    // 从URL参数获取卡密
    const cardCodeParam = props.$w.page.dataset.params.cardCode || '';
    setCardCode(cardCodeParam);
  }, [props.$w.page.dataset.params.cardCode]);

  // 标记卡密为已使用
  const markCardAsUsed = async () => {
    try {
      const tcb = await $w.cloud.getCloudInstance();
      const db = tcb.database();

      // 查找卡密
      const result = await db.collection('card_code_manage').where({
        card_code: cardCode
      }).get();
      if (result.data && result.data.length > 0) {
        const card = result.data[0];
        // 检查卡密是否已被标记为使用
        if (card.used === true) {
          return false;
        }
        // 标记卡密为已使用
        await db.collection('card_code_manage').doc(card._id).update({
          used: true,
          used_time: new Date().toISOString()
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('标记卡密失败', error);
      return false;
    }
  };

  // 处理选择跳转
  const handleSelect = async type => {
    if (!cardCode) {
      toast({
        title: '卡密无效',
        description: '请重新输入卡密',
        variant: 'destructive'
      });
      return;
    }
    setLoading(true);
    try {
      // 验证卡密状态
      const tcb = await $w.cloud.getCloudInstance();
      const db = tcb.database();
      const result = await db.collection('card_code_manage').where({
        card_code: cardCode
      }).get();
      if (!result.data || result.data.length === 0) {
        toast({
          title: '卡密不存在',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }
      const card = result.data[0];

      // 检查卡密是否已被使用
      if (card.used === true) {
        toast({
          title: '卡密已使用',
          description: '该卡密已被使用，无法再次使用',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // 标记卡密为已使用
      const markSuccess = await markCardAsUsed();
      if (!markSuccess) {
        toast({
          title: '卡密状态异常',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // 跳转到对应的生成页面
      let targetPage = 'rename';
      if (type === 'blank') {
        targetPage = 'blank-name';
      } else if (type === 'special') {
        // 特殊名跳转到重复名页面
        targetPage = 'rename';
      }
      toast({
        title: '选择成功'
      });
      $w.utils.navigateTo({
        pageId: targetPage,
        params: {
          cardCode: cardCode
        }
      });
    } catch (error) {
      console.error('选择失败', error);
      toast({
        title: '选择失败',
        description: error.message || '请重试',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  const options = [{
    id: 'blank',
    title: '空白名',
    description: '生成空白名字，适合特殊场景',
    icon: '⬜',
    color: 'from-blue-500 to-blue-600'
  }, {
    id: 'rename',
    title: '重复名',
    description: '生成带装饰的重复名字',
    icon: '🔄',
    color: 'from-purple-500 to-purple-600'
  }, {
    id: 'special',
    title: '特殊名',
    description: '生成特殊风格的名字',
    icon: '⭐',
    color: 'from-orange-500 to-orange-600'
  }];
  return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              修改名字类型
            </h1>
            <p className="text-slate-600 text-sm">
              下单什么选什么，选后无法更换
            </p>
            <div className="mt-4 inline-block bg-blue-50 px-4 py-2 rounded-lg">
              <span className="text-blue-600 font-medium text-sm">
                卡密: {cardCode}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {options.map(option => <button key={option.id} onClick={() => handleSelect(option.id)} disabled={loading} className={`
                  relative p-6 rounded-xl
                  bg-gradient-to-br ${option.color}
                  hover:opacity-90 transition-all duration-200
                  shadow-md hover:shadow-lg
                  disabled:opacity-50 disabled:cursor-not-allowed
                  text-left group
                `}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{option.icon}</span>
                    <h3 className="text-xl font-bold text-white">
                      {option.title}
                    </h3>
                  </div>
                  <ChevronRight className="w-6 h-6 text-white/70 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>)}
          </div>

          <div className="mt-8 p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200">
            <div className="space-y-3">
              {/* 警告提示 */}
              <div className="bg-amber-100/50 px-4 py-2 rounded-lg">
                <p className="text-amber-800 text-xs text-center font-semibold">
                  ⚠️ 提示：选择后卡密将被标记为使用状态，无法再次使用
                </p>
              </div>
              
              {/* 改名卡提示 */}
              <p className="text-slate-700 text-sm text-center font-bold">
                1. 改名卡自备哦~
              </p>
              
              {/* 微信公众号信息 */}
              <div className="bg-white/60 px-4 py-3 rounded-lg">
                <p className="text-orange-600 text-sm text-center font-bold mb-1">
                  2. 关注【微信公众号】：乐悦电竞游戏服务
                </p>
                <p className="text-slate-600 text-xs text-center leading-relaxed mb-2">
                  【可享受免费改名，免费查询战区英雄战力】
                </p>
                {/* 微信公众号二维码 */}
                <div className="flex justify-center mb-2">
                  <img src="https://wz-2025-4gib97u1be0f39a7-1257774687.tcloudbaseapp.com/resources/2026-03/lowcode-2449413" alt="微信公众号二维码" className="w-[280px] h-auto rounded-lg shadow-sm cursor-pointer" style={{
                  userSelect: 'none',
                  touchAction: 'auto'
                }} />
                </div>
                <p className="text-slate-500 text-xs text-center mb-2">
                  长按二维码可保存图片
                </p>
              </div>
              
              {/* 更多服务 */}
              <div className="bg-white/60 px-4 py-3 rounded-lg">
                <p className="text-orange-600 text-xs text-center font-bold leading-relaxed">
                  【免费获取名片元流图片库 王者查战力 改名卡密】
                </p>
              </div>
              
              {/* 底部服务名称 */}
              <p className="text-orange-500 text-xs text-center font-bold">
                乐悦电竞游戏服务
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>;
}