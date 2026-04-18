// @ts-ignore;
import React, { useState } from 'react';
// @ts-ignore;
import { useToast } from '@/components/ui';

// 生成设备ID
const getDeviceId = () => {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
};

// 检查是否被冻结
const checkFreeze = async (deviceId, userIp) => {
  try {
    const tcb = await $w.cloud.getCloudInstance();
    const db = tcb.database();
    const now = new Date();

    // 查询该设备的冻结记录
    const result = await db.collection('anti_blast_record').where({
      device_id: deviceId,
      user_ip: userIp
    }).get();
    if (result.data && result.data.length > 0) {
      const record = result.data[0];
      if (record.freeze_until && new Date(record.freeze_until) > now) {
        const freezeTime = new Date(record.freeze_until);
        const hoursRemaining = Math.ceil((freezeTime - now) / (1000 * 60 * 60));
        return {
          isFrozen: true,
          reason: record.freeze_reason,
          remainingTime: hoursRemaining
        };
      }
    }
    return {
      isFrozen: false
    };
  } catch (error) {
    console.error('检查冻结状态失败', error);
    return {
      isFrozen: false
    };
  }
};

// 记录错误尝试
const recordErrorAttempt = async (deviceId, userIp, errorType) => {
  try {
    const tcb = await $w.cloud.getCloudInstance();
    const db = tcb.database();

    // 查询是否已有记录
    const existing = await db.collection('anti_blast_record').where({
      device_id: deviceId,
      user_ip: userIp
    }).get();
    let currentRecord;
    if (existing.data && existing.data.length > 0) {
      currentRecord = existing.data[0];
    } else {
      currentRecord = {
        device_id: deviceId,
        user_ip: userIp,
        error_count: 0,
        short_code_error_count: 0,
        last_attempt_time: new Date().toISOString()
      };
    }
    const now = new Date();
    // 清理过期的错误计数（24小时前的错误计数重置）
    const lastAttempt = currentRecord.last_attempt_time ? new Date(currentRecord.last_attempt_time) : now;
    const hoursSinceLastAttempt = (now - lastAttempt) / (1000 * 60 * 60);
    if (hoursSinceLastAttempt >= 24) {
      currentRecord.error_count = 0;
      currentRecord.short_code_error_count = 0;
    }

    // 根据错误类型增加计数
    if (errorType === 'short_code') {
      currentRecord.short_code_error_count = (currentRecord.short_code_error_count || 0) + 1;
    } else if (errorType === 'invalid_code') {
      currentRecord.error_count = (currentRecord.error_count || 0) + 1;
    }
    currentRecord.last_attempt_time = now.toISOString();

    // 判断是否需要冻结
    let shouldFreeze = false;
    let freezeReason = '';
    let freezeDuration = 0;
    if (currentRecord.short_code_error_count >= 10) {
      shouldFreeze = true;
      freezeReason = '连续输入长度不足卡密超过10次';
      freezeDuration = 7 * 24 * 60 * 60 * 1000; // 7天
    } else if (currentRecord.error_count >= 5) {
      shouldFreeze = true;
      freezeReason = '连续输入错误卡密超过5次';
      freezeDuration = 24 * 60 * 60 * 1000; // 1天
    }
    if (shouldFreeze) {
      currentRecord.freeze_until = new Date(now.getTime() + freezeDuration).toISOString();
      currentRecord.freeze_reason = freezeReason;
    }
    if (existing.data && existing.data.length > 0) {
      await db.collection('anti_blast_record').doc(existing.data[0]._id).update(currentRecord);
    } else {
      await db.collection('anti_blast_record').add(currentRecord);
    }
  } catch (error) {
    console.error('记录错误尝试失败', error);
  }
};
export default function Home(props) {
  const {
    toast
  } = useToast();
  const [cardCode, setCardCode] = useState('');
  const [loading, setLoading] = useState(false);
  const handleVerify = async () => {
    if (!cardCode.trim()) {
      toast({
        title: '请输入卡密',
        variant: 'destructive'
      });
      return;
    }

    // 获取设备ID和IP
    const deviceId = getDeviceId();
    let userIp = '';
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      userIp = ipData.ip || '';
    } catch (ipError) {
      console.error('获取IP失败', ipError);
      userIp = 'unknown';
    }

    // 检查是否被冻结
    const freezeStatus = await checkFreeze(deviceId, userIp);
    if (freezeStatus.isFrozen) {
      toast({
        title: '账号已被冻结',
        description: `冻结原因：${freezeStatus.reason}，请${freezeStatus.remainingTime}小时后重试`,
        variant: 'destructive'
      });
      return;
    }
    const trimmedCode = cardCode.trim();

    // 检查卡密长度（18位）
    if (trimmedCode.length !== 18) {
      toast({
        title: '卡密错误',
        description: '请输入18位正确的卡密',
        variant: 'destructive'
      });
      // 记录长度不足错误
      await recordErrorAttempt(deviceId, userIp, 'short_code');
      return;
    }
    setLoading(true);
    try {
      const tcb = await $w.cloud.getCloudInstance();
      const db = tcb.database();
      const result = await db.collection('card_code_manage').get();

      // 查找匹配的卡密
      const card = (result.data || []).find(c => c.card_code === trimmedCode);
      if (!card) {
        toast({
          title: '卡密不存在',
          variant: 'destructive'
        });
        // 记录错误卡密
        await recordErrorAttempt(deviceId, userIp, 'invalid_code');
        setLoading(false);
        return;
      }

      // 检查卡密是否还有生成次数
      if (card.remaining_times <= 0) {
        toast({
          title: '该卡密已达生成次数上限',
          description: '每个卡密最多生成20次，请联系管理员充值',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // 创建访问记录
      try {
        await db.collection('user_access_record').add({
          card_code: trimmedCode,
          access_time: new Date().toISOString(),
          generated_name: '',
          user_ip: userIp
        });
      } catch (recordError) {
        console.error('创建访问记录失败', recordError);
      }

      // 验证成功，重置错误计数（可选，这里不重置以保持防爆破效果）
      // await recordErrorAttempt(deviceId, userIp, 'success'); // 清除错误计数

      // 验证成功，跳转到选择页面
      toast({
        title: '验证成功'
      });
      $w.utils.navigateTo({
        pageId: 'name-select',
        params: {
          cardCode: trimmedCode
        }
      });
    } catch (error) {
      console.error('验证失败', error);
      toast({
        title: '验证失败',
        description: error.message || '网络错误，请重试',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  return <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 乐悦电竞 logo */}
        <div className="flex justify-center mb-6">
          <img src="https://wz-2025-4gib97u1be0f39a7-1257774687.tcloudbaseapp.com/resources/2026-04/lowcode-2450255" alt="乐悦电竞 logo" className="w-[180px] h-auto" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-800 mb-8 text-center">
          卡密验证
        </h1>
        <div className="space-y-4">
          <div>
            <input type="text" value={cardCode} onChange={e => setCardCode(e.target.value)} placeholder="请输入卡密" className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:border-gray-500 text-gray-800" disabled={loading} onKeyPress={e => e.key === 'Enter' && handleVerify()} />
          </div>
          <button onClick={handleVerify} disabled={loading} className="w-full py-3 bg-gray-800 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
            {loading ? '验证中...' : '验证'}
          </button>
        </div>
      </div>
    </div>;
}