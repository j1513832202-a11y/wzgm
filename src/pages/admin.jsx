// @ts-ignore;
import load_skill, { useState, useEffect } from 'react';
// @ts-ignore;
import { useToast, Button, Input, Checkbox, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationEllipsis, PaginationNext } from '@/components/ui';
// @ts-ignore;
import { Trash2, Plus, Minus, RefreshCw, CheckSquare, Square, Copy, Search, AlertTriangle } from 'lucide-react';

export default function Admin(props) {
  const {
    $w
  } = props;
  const {
    toast
  } = useToast();
  const [activeTab, setActiveTab] = useState('codes');
  const [codes, setCodes] = useState([]);
  const [cardCodes, setCardCodes] = useState([]);
  const [accessRecords, setAccessRecords] = useState([]);
  const [recordSearchKeyword, setRecordSearchKeyword] = useState('');
  const [recordsPageSize, setRecordsPageSize] = useState('50');
  const [recordsCurrentPage, setRecordsCurrentPage] = useState(1);
  const [cardSearchKeyword, setCardSearchKeyword] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newCodeRemark, setNewCodeRemark] = useState('');
  const [batchCount, setBatchCount] = useState('10');
  const [generateTimes, setGenerateTimes] = useState('20');
  const [isLoading, setIsLoading] = useState(false);

  // 分页和全选相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [selectedCards, setSelectedCards] = useState([]);
  const [isAllSelected, setIsAllSelected] = useState(false);

  // 简单的会话检查（实际项目应该使用更安全的认证）
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  useEffect(() => {
    // 检查是否从登录页面跳转过来
    const checkSession = () => {
      const hasSession = sessionStorage.getItem('adminSession');
      if (!hasSession) {
        // 立即重定向到登录页面，防止未授权用户看到任何管理后台内容
        $w.utils.redirectTo({
          pageId: 'admin-login',
          params: {}
        });
        return;
      }
      setIsLoggedIn(true);
      setIsChecking(false);
    };
    checkSession();
  }, [$w]);

  // 加载数据
  const loadData = async () => {
    if (!isLoggedIn) return;
    setIsLoading(true);
    try {
      // 使用原生数据库 API 查询数据
      const tcb = await $w.cloud.getCloudInstance();
      const db = tcb.database();

      // 查询 rename_code_lib（数量较少，直接查询）
      const codesResult = await db.collection('rename_code_lib').get();

      // 查询 card_code_manage（可能有很多数据，需要循环查询）
      let allCards = [];
      let hasMore = true;
      let skip = 0;
      const batchSize = 100;
      while (hasMore) {
        const batchResult = await db.collection('card_code_manage').skip(skip).limit(batchSize).get();
        if (batchResult.data && batchResult.data.length > 0) {
          allCards = allCards.concat(batchResult.data);
          skip += batchResult.data.length;
          // 如果返回的数据少于批次大小，说明已经是最后一批
          if (batchResult.data.length < batchSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      // 查询 user_access_record（数量较少，直接查询）
      const recordsResult = await db.collection('user_access_record').orderBy('access_time', 'desc').get();

      // 处理数据：云开发数据库返回的每个文档已经是完整的卡密对象
      const processedCodes = (codesResult.data || []).filter(item => {
        // 不过滤空代码内容，允许所有代码（包括简单数字如 '1'）
        return true;
      });
      const processedCards = allCards;
      const processedRecords = recordsResult.data || [];
      setCodes(processedCodes);
      setCardCodes(processedCards);
      setAccessRecords(processedRecords);

      // 自动清理超过10天的访问记录
      await autoCleanOldRecords();
    } catch (error) {
      console.error('加载数据失败', error);
      toast({
        title: '加载数据失败',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    if (isLoggedIn) {
      loadData();
    }
  }, [isLoggedIn]);

  // 当卡密列表变化或搜索关键词变化时，重置分页和选择
  useEffect(() => {
    setCurrentPage(1);
    setSelectedCards([]);
    setIsAllSelected(false);
  }, [cardCodes, cardSearchKeyword]);

  // 当访问记录搜索关键词变化时，重置分页
  useEffect(() => {
    setRecordsCurrentPage(1);
  }, [recordSearchKeyword]);

  // 自动清理旧记录（超过10天的记录）
  const autoCleanOldRecords = async () => {
    try {
      const tcb = await $w.cloud.getCloudInstance();
      const db = tcb.database();
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const result = await db.collection('user_access_record').where({
        access_time: db.command.lt(tenDaysAgo.toISOString())
      }).remove();
      if (result.removed > 0) {
        console.log(`自动清理了 ${result.removed} 条超过10天的访问记录`);
        // 重新加载访问记录
        const recordsResult = await db.collection('user_access_record').orderBy('access_time', 'desc').get();
        setAccessRecords(recordsResult.data || []);
      }
    } catch (error) {
      console.error('自动清理旧记录失败', error);
    }
  };

  // 手动清理所有记录
  const handleCleanAllRecords = async () => {
    if (!confirm('确定要清理所有访问记录吗？此操作不可恢复。')) {
      return;
    }
    setIsLoading(true);
    try {
      const tcb = await $w.cloud.getCloudInstance();
      const db = tcb.database();

      // 删除所有记录（分批删除以避免超时）
      let removedCount = 0;
      let batchLimit = 100;
      let hasMore = true;
      while (hasMore) {
        const recordsResult = await db.collection('user_access_record').limit(batchLimit).get();
        if (recordsResult.data && recordsResult.data.length > 0) {
          const ids = recordsResult.data.map(record => record._id);
          const removeResult = await db.collection('user_access_record').where({
            _id: db.command.in(ids)
          }).remove();
          removedCount += removeResult.removed;
          hasMore = recordsResult.data.length >= batchLimit;
        } else {
          hasMore = false;
        }
      }
      setAccessRecords([]);
      toast({
        title: '清理完成',
        description: `已清理 ${removedCount} 条访问记录`
      });
    } catch (error) {
      console.error('清理记录失败', error);
      toast({
        title: '清理失败',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 手动清理超过10天的记录
  const handleCleanOldRecords = async () => {
    if (!confirm('确定要清理超过10天的访问记录吗？此操作不可恢复。')) {
      return;
    }
    setIsLoading(true);
    try {
      const tcb = await $w.cloud.getCloudInstance();
      const db = tcb.database();
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      let removedCount = 0;
      let batchLimit = 100;
      let hasMore = true;
      while (hasMore) {
        const recordsResult = await db.collection('user_access_record').where({
          access_time: db.command.lt(tenDaysAgo.toISOString())
        }).limit(batchLimit).get();
        if (recordsResult.data && recordsResult.data.length > 0) {
          const ids = recordsResult.data.map(record => record._id);
          const removeResult = await db.collection('user_access_record').where({
            _id: db.command.in(ids)
          }).remove();
          removedCount += removeResult.removed;
          hasMore = recordsResult.data.length >= batchLimit;
        } else {
          hasMore = false;
        }
      }

      // 重新加载访问记录
      const recordsResult = await db.collection('user_access_record').orderBy('access_time', 'desc').get();
      setAccessRecords(recordsResult.data || []);
      toast({
        title: '清理完成',
        description: `已清理 ${removedCount} 条超过10天的访问记录`
      });
    } catch (error) {
      console.error('清理记录失败', error);
      toast({
        title: '清理失败',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 正在检查会话时显示加载状态，避免用户看到未授权的内容
  if (isChecking) {
    return <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-500">正在验证权限...</p>
        </div>
      </div>;
  }

  // 上传空白代码
  const handleUploadCode = async () => {
    // 不进行 trim() 处理，保留用户输入的原始字符（包括空白字符）
    const codeContent = newCode;

    // 检查是否为空字符串
    if (codeContent === '') {
      toast({
        title: '请输入空白代码',
        description: '不能为空',
        variant: 'destructive'
      });
      return;
    }

    // 检查长度限制（只能输入一个字符）
    if (codeContent.length !== 1) {
      toast({
        title: '代码长度错误',
        description: '代码只能输入一个字符',
        variant: 'destructive'
      });
      return;
    }

    // 检查是否已经存在相同的代码
    if (codes.some(code => code.code_content === codeContent)) {
      toast({
        title: '代码已存在',
        description: '该代码已添加，请勿重复录入',
        variant: 'destructive'
      });
      return;
    }
    setIsLoading(true);
    try {
      console.log('准备上传代码:', codeContent, '长度:', codeContent.length);

      // 使用原生数据库 API
      const tcb = await $w.cloud.getCloudInstance();
      const db = tcb.database();
      const uploadTime = new Date().toISOString();
      const result = await db.collection('rename_code_lib').add({
        code_content: codeContent,
        remark: newCodeRemark || '',
        upload_time: uploadTime
      });
      console.log('上传结果:', result);

      // 检查上传是否成功（检查 result 对象的结构）
      if (result && (result.id || result._id || result.ids && result.ids.length > 0)) {
        // 直接将新代码添加到列表中，无需刷新
        const newCodeObj = {
          _id: result.id || result._id || result.ids[0],
          code_content: codeContent,
          remark: newCodeRemark || '',
          upload_time: uploadTime
        };
        setCodes([newCodeObj, ...codes]);
        setNewCode('');
        setNewCodeRemark('');
        toast({
          title: '上传成功',
          description: `代码: ${codeContent}`
        });
      } else {
        throw new Error('上传失败，未返回有效的ID');
      }
    } catch (error) {
      console.error('上传失败', error);
      toast({
        title: '上传失败',
        description: error.message || '请检查网络连接或数据库连接',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 删除空白代码
  const handleDeleteCode = async id => {
    setIsLoading(true);
    try {
      // 使用原生数据库 API 删除数据
      const tcb = await $w.cloud.getCloudInstance();
      const db = tcb.database();
      const collection = db.collection('rename_code_lib');
      const result = await collection.doc(id).remove();
      if (result.deleted > 0) {
        toast({
          title: '删除成功'
        });
        await loadData();
      } else {
        throw new Error('删除失败');
      }
    } catch (error) {
      console.error('删除失败', error);
      toast({
        title: '删除失败',
        description: error.message || '请检查数据库连接',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 批量生成卡密
  const handleBatchGenerateCards = async () => {
    const count = parseInt(batchCount);
    if (!count || count < 1 || count > 10000) {
      toast({
        title: '请输入1-10000之间的数量',
        variant: 'destructive'
      });
      return;
    }

    // 验证生成次数
    let times = parseInt(generateTimes);
    if (!times || times < 1) {
      times = 20; // 默认20次
    }
    if (times > 100) {
      toast({
        title: '生成次数不能超过100次',
        variant: 'destructive'
      });
      return;
    }
    setIsLoading(true);
    try {
      console.log('准备生成', count, '张卡密，每张', times, '次');

      // 使用原生数据库 API
      const tcb = await $w.cloud.getCloudInstance();
      const db = tcb.database();
      const collection = db.collection('card_code_manage');

      // 批量生成卡密数据，每个卡密作为一个独立的文档插入
      const cards = [];
      for (let i = 0; i < count; i++) {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        const cardCode = 'CARD' + timestamp.toString(36).toUpperCase() + randomStr;
        cards.push({
          card_code: cardCode,
          remaining_times: times
        });
      }
      console.log('卡密数据:', cards);

      // 逐个插入卡密，每个卡密作为独立的文档
      const insertPromises = cards.map(card => collection.add(card));
      const results = await Promise.all(insertPromises);
      console.log('插入结果:', results);

      // 检查插入结果 - 云开发 add 方法返回的是 _id 字符串数组
      const successCount = results.filter(r => r).length;
      if (successCount > 0) {
        toast({
          title: `成功生成 ${successCount} 张卡密`,
          description: '卡密已添加到列表中'
        });
        // 立即刷新数据显示
        await loadData();
      } else {
        throw new Error('生成失败，未成功插入任何记录');
      }
    } catch (error) {
      console.error('生成失败', error);
      toast({
        title: '生成失败',
        description: error.message || '请检查数据库连接',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 查看卡密使用记录
  const handleViewCardRecords = cardCode => {
    const records = accessRecords.filter(r => r.card_code === cardCode);
    if (records.length === 0) {
      toast({
        title: `卡密 ${cardCode} 暂无使用记录`,
        variant: 'destructive'
      });
      return;
    }
    const recordText = records.map(r => `IP: ${r.user_ip} | 时间: ${new Date(r.access_time).toLocaleString('zh-CN')} | 昵称: ${r.generated_name}`).join('\n');
    alert(`卡密 ${cardCode} 使用记录：\n\n${recordText}`);
  };

  // 删除卡密
  const handleDeleteCard = async (id, cardCode) => {
    if (!window.confirm(`确定要删除卡密 ${cardCode} 吗？删除后将无法使用此卡密。`)) {
      return;
    }
    setIsLoading(true);
    try {
      // 使用原生数据库 API 删除数据
      const tcb = await $w.cloud.getCloudInstance();
      const db = tcb.database();
      const collection = db.collection('card_code_manage');
      const result = await collection.doc(id).remove();
      if (result.deleted > 0) {
        toast({
          title: '删除成功'
        });
        await loadData();
      } else {
        throw new Error('删除失败');
      }
    } catch (error) {
      console.error('删除失败', error);
      toast({
        title: '删除失败',
        description: error.message || '请检查数据库连接',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 调整卡密次数
  const handleUpdateCardTimes = async (id, cardCode, value) => {
    const card = cardCodes.find(c => c._id === id && c.card_code === cardCode);
    if (!card) {
      toast({
        title: '卡密不存在',
        variant: 'destructive'
      });
      return;
    }
    let newTimes;
    if (typeof value === 'number') {
      // 是增减操作
      newTimes = (card.remaining_times || 0) + value;
    } else {
      // 是直接输入的值
      newTimes = parseInt(value) || 0;
    }

    // 验证：次数不能小于0，不能超过100
    if (newTimes < 0) {
      toast({
        title: '次数不能小于0',
        variant: 'destructive'
      });
      return;
    }
    if (newTimes > 100) {
      toast({
        title: '次数不能超过100次',
        variant: 'destructive'
      });
      return;
    }

    // 立即更新本地状态，提供即时反馈
    const updatedCards = cardCodes.map(c => c._id === id ? {
      ...c,
      remaining_times: newTimes
    } : c);
    setCardCodes(updatedCards);
    setIsLoading(true);
    try {
      const tcb = await $w.cloud.getCloudInstance();
      const db = tcb.database();
      const collection = db.collection('card_code_manage');

      // 直接更新文档的 remaining_times 字段
      const result = await collection.doc(id).update({
        remaining_times: newTimes
      });
      if (result.updated >= 1) {
        // 立即更新本地状态，无需重新加载数据
        const updatedCards = cardCodes.map(c => c._id === id ? {
          ...c,
          remaining_times: newTimes
        } : c);
        setCardCodes(updatedCards);
        toast({
          title: '调整成功',
          description: `卡密 ${cardCode} 次数已调整为 ${newTimes}`
        });
      } else {
        throw new Error('调整失败');
      }
    } catch (error) {
      console.error('调整失败', error);
      toast({
        title: '调整失败',
        description: error.message || '请检查数据库连接',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 处理单个卡密选择
  const handleCardSelect = cardId => {
    setSelectedCards(prev => {
      if (prev.includes(cardId)) {
        return prev.filter(id => id !== cardId);
      } else {
        return [...prev, cardId];
      }
    });
  };

  // 处理全选
  const handleSelectAll = () => {
    const paginatedCards = getPagedCards();
    if (isAllSelected) {
      setSelectedCards([]);
      setIsAllSelected(false);
    } else {
      setSelectedCards(paginatedCards.map(card => card._id));
      setIsAllSelected(true);
    }
  };

  // 获取当前页的卡密
  const getPagedCards = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return cardCodes.slice(startIndex, endIndex);
  };

  // 获取总页数
  const getTotalPages = () => {
    return Math.ceil(cardCodes.length / pageSize) || 1;
  };

  // 全复制
  const handleCopyAll = async () => {
    if (selectedCards.length === 0) {
      toast({
        title: '请先选择要复制的卡密',
        variant: 'destructive'
      });
      return;
    }
    const selectedCardData = cardCodes.filter(card => selectedCards.includes(card._id));
    const cardCodesText = selectedCardData.map(card => card.card_code).join('\n');
    try {
      await navigator.clipboard.writeText(cardCodesText);
      toast({
        title: '复制成功',
        description: `已复制 ${selectedCards.length} 个卡密`
      });
    } catch (error) {
      toast({
        title: '复制失败',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // 全删除
  const handleDeleteAll = async () => {
    if (selectedCards.length === 0) {
      toast({
        title: '请先选择要删除的卡密',
        variant: 'destructive'
      });
      return;
    }
    if (!window.confirm(`确定要删除选中的 ${selectedCards.length} 个卡密吗？删除后将无法恢复。`)) {
      return;
    }
    setIsLoading(true);
    try {
      const tcb = await $w.cloud.getCloudInstance();
      const db = tcb.database();
      const collection = db.collection('card_code_manage');

      // 批量删除
      const deletePromises = selectedCards.map(cardId => collection.doc(cardId).remove());
      const results = await Promise.all(deletePromises);
      const successCount = results.filter(r => r.deleted > 0).length;
      if (successCount > 0) {
        toast({
          title: '删除成功',
          description: `已删除 ${successCount} 个卡密`
        });
        setSelectedCards([]);
        setIsAllSelected(false);
        await loadData();
      } else {
        throw new Error('删除失败');
      }
    } catch (error) {
      console.error('删除失败', error);
      toast({
        title: '删除失败',
        description: error.message || '请检查数据库连接',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  if (!isLoggedIn) {
    return <div className="min-h-screen bg-white flex items-center justify-center">验证中...</div>;
  }
  return <div className="min-h-screen bg-white">
      {/* 导航栏 */}
      <div className="border-b border-[#E5E5E5] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-lg font-medium text-[#333333]">管理后台</h1>
            <Button variant="ghost" onClick={() => {
            sessionStorage.removeItem('adminSession');
            $w.utils.navigateTo({
              pageId: 'admin-login',
              params: {}
            });
          }} className="text-gray-500 hover:text-[#333333]">
              退出登录
            </Button>
          </div>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="border-b border-[#E5E5E5] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button onClick={() => setActiveTab('codes')} className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'codes' ? 'border-[#333333] text-[#333333]' : 'border-transparent text-gray-500 hover:text-[#333333]'}`}>
              空白代码库
            </button>
            <button onClick={() => setActiveTab('cards')} className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'cards' ? 'border-[#333333] text-[#333333]' : 'border-transparent text-gray-500 hover:text-[#333333]'}`}>
              卡密管理
            </button>
            <button onClick={() => setActiveTab('records')} className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'records' ? 'border-[#333333] text-[#333333]' : 'border-transparent text-gray-500 hover:text-[#333333]'}`}>
              访问记录
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 刷新按钮 */}
        <div className="flex justify-end mb-6">
          <Button variant="outline" onClick={loadData} disabled={isLoading} className="border-[#E5E5E5] text-[#333333] hover:bg-[#FAFAFA]">
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
        </div>

        {/* 空白代码库标签页 */}
        {activeTab === 'codes' && <div>
            {/* 上传区域 */}
            <div className="mb-6 p-4 bg-[#F5F5F5] rounded">
              <h3 className="text-sm font-medium text-[#333333] mb-3">上传空白代码</h3>
              <div className="space-y-3">
                <Input placeholder="输入空白代码（只能输入一个字符，如：ㅤ）" value={newCode} onChange={e => setNewCode(e.target.value)} className="w-full bg-white border-[#E5E5E5] focus:border-[#333333] focus:ring-0" maxLength={1} />
                <Input placeholder="输入备注（可选）" value={newCodeRemark} onChange={e => setNewCodeRemark(e.target.value)} className="w-full bg-white border-[#E5E5E5] focus:border-[#333333] focus:ring-0" />
                <div className="flex justify-end">
                  <Button onClick={handleUploadCode} disabled={isLoading} className="bg-[#333333] hover:bg-black text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    上传
                  </Button>
                </div>
              </div>
            </div>

            {/* 代码列表表格 */}
            <div className="bg-white border border-[#E5E5E5] rounded overflow-hidden">
              <table className="min-w-full divide-y divide-[#E5E5E5]">
                <thead className="bg-[#F5F5F5]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#333333] uppercase tracking-wider">
                      代码内容
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#333333] uppercase tracking-wider">
                      备注
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#333333] uppercase tracking-wider">
                      上传时间
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[#333333] uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#E5E5E5]">
                  {codes.filter(code => code.code_content !== '').length === 0 ? <tr>
                      <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                        暂无数据
                      </td>
                    </tr> : codes.filter(code => code.code_content !== '').map(code => <tr key={code._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                            {code.code_content || '(空)'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {code.remark || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {code.upload_time ? new Date(code.upload_time).toLocaleString('zh-CN') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteCode(code._id)} disabled={isLoading} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>)}
                </tbody>
              </table>
            </div>
          </div>}

        {/* 卡密管理标签页 */}
        {activeTab === 'cards' && <div>
            {/* 批量生成区域 */}
            <div className="mb-6 p-4 bg-[#F5F5F5] rounded">
              <h3 className="text-sm font-medium text-[#333333] mb-3">批量生成卡密</h3>
              <p className="text-xs text-gray-500 mb-3">每个卡密可生成指定次数的昵称，每次成功生成后次数自动减少1，不输入则默认20次</p>
              <div className="flex gap-2 mb-2">
                <Input type="number" placeholder="生成数量（1-10000）" value={batchCount} onChange={e => setBatchCount(e.target.value)} className="flex-1 bg-white border-[#E5E5E5] focus:border-[#333333] focus:ring-0" />
                <Input type="number" placeholder="生成次数（默认20）" value={generateTimes} onChange={e => setGenerateTimes(e.target.value)} className="w-32 bg-white border-[#E5E5E5] focus:border-[#333333] focus:ring-0" />
                <Button onClick={handleBatchGenerateCards} disabled={isLoading} className="bg-[#333333] hover:bg-black text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  生成
                </Button>
              </div>
            </div>

            {/* 搜索区域 */}
            <div className="mb-4">
              <div className="flex gap-2">
                <Input placeholder="搜索卡密（输入卡密后按回车或点击搜索）" value={cardSearchKeyword} onChange={e => setCardSearchKeyword(e.target.value)} onKeyDown={e => {
              if (e.key === 'Enter') {
                // 搜索功能已通过实时过滤实现，无需额外操作
              }
            }} className="flex-1 bg-white border-[#E5E5E5] focus:border-[#333333] focus:ring-0" />
                <Button onClick={() => {}} disabled={isLoading} className="bg-[#333333] hover:bg-black text-white">
                  <Search className="w-4 h-4 mr-2" />
                  搜索
                </Button>
                {cardSearchKeyword && <Button variant="outline" onClick={() => setCardSearchKeyword('')} className="border-[#E5E5E5] text-[#333333] hover:bg-[#FAFAFA]">
                    清空
                  </Button>}
              </div>
            </div>

            {/* 批量操作按钮 */}
            {selectedCards.length > 0 && <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-blue-800">已选择 {selectedCards.length} 个卡密</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyAll} className="border-blue-300 text-blue-700 hover:bg-blue-100">
                    <Copy className="w-4 h-4 mr-2" />
                    全复制
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDeleteAll} disabled={isLoading} className="border-red-300 text-red-700 hover:bg-red-100">
                    <Trash2 className="w-4 h-4 mr-2" />
                    全删除
                  </Button>
                </div>
              </div>}

            {/* 卡密列表表格 */}
            <div className="bg-white border border-[#E5E5E5] rounded overflow-hidden">
              <table className="min-w-full divide-y divide-[#E5E5E5]">
                <thead className="bg-[#F5F5F5]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#333333] uppercase tracking-wider w-12">
                      <button onClick={handleSelectAll} className="flex items-center justify-center w-full">
                        {isAllSelected ? <CheckSquare className="w-4 h-4 text-[#333333]" /> : <Square className="w-4 h-4 text-gray-400" />}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#333333] uppercase tracking-wider">
                      卡密
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#333333] uppercase tracking-wider">
                      生成次数
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[#333333] uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#E5E5E5]">
                  {(() => {
                // 根据搜索关键词过滤卡密
                const filteredCardCodes = cardSearchKeyword ? cardCodes.filter(card => card.card_code && card.card_code.includes(cardSearchKeyword.trim())) : cardCodes;
                const pagedCards = filteredCardCodes.slice((currentPage - 1) * pageSize, currentPage * pageSize);
                if (filteredCardCodes.length === 0) {
                  return <tr key="no-data">
                          <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                            {cardSearchKeyword ? '未找到匹配的卡密' : '暂无数据'}
                          </td>
                        </tr>;
                }
                return pagedCards.map(card => <tr key={card._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <Checkbox checked={selectedCards.includes(card._id)} onCheckedChange={() => handleCardSelect(card._id)} className="border-[#E5E5E5]" />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                          {card.card_code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleUpdateCardTimes(card._id, card.card_code, -1)} disabled={isLoading || card.remaining_times <= 0} className="w-8 h-8 p-0 border-[#E5E5E5] hover:bg-[#FAFAFA]">
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input type="number" min={0} max={100} value={card.remaining_times || 0} onChange={e => {
                        const newValue = parseInt(e.target.value) || 0;
                        if (newValue >= 0 && newValue <= 100) {
                          // 实时更新本地状态，提供即时反馈
                          const updatedCards = cardCodes.map(c => c._id === card._id ? {
                            ...c,
                            remaining_times: newValue
                          } : c);
                          setCardCodes(updatedCards);
                        }
                      }} onBlur={e => handleUpdateCardTimes(card._id, card.card_code, e.target.value)} onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handleUpdateCardTimes(card._id, card.card_code, e.target.value);
                          e.target.blur();
                        }
                      }} className="w-16 h-8 text-center text-sm border-[#E5E5E5] focus:border-[#333333] focus:ring-0 px-2 py-1" />
                            <Button variant="outline" size="sm" onClick={() => handleUpdateCardTimes(card._id, card.card_code, 1)} disabled={isLoading || card.remaining_times >= 100} className="w-8 h-8 p-0 border-[#E5E5E5] hover:bg-[#FAFAFA]">
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleViewCardRecords(card.card_code)} className="border-[#E5E5E5] text-[#333333] hover:bg-[#FAFAFA]">
                              查看记录
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteCard(card._id, card.card_code)} disabled={isLoading} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>);
              })()}
                </tbody>
              </table>
              
              {/* 分页控制 */}
              {(() => {
            // 根据搜索关键词计算总数
            const filteredCardCodes = cardSearchKeyword ? cardCodes.filter(card => card.card_code && card.card_code.includes(cardSearchKeyword.trim())) : cardCodes;
            const totalFiltered = filteredCardCodes.length;
            const filteredTotalPages = Math.ceil(totalFiltered / pageSize);
            if (totalFiltered === 0) return null;
            return <div className="px-6 py-4 bg-[#FAFAFA] border-t border-[#E5E5E5] flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    显示 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalFiltered)} 条，共 {totalFiltered} 条
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1 || isLoading} className="border-[#E5E5E5] text-[#333333] hover:bg-[#FAFAFA]">
                      上一页
                    </Button>
                    <span className="text-sm text-[#333333]">
                      第 {currentPage} / {filteredTotalPages} 页
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(filteredTotalPages, p + 1))} disabled={currentPage >= filteredTotalPages || isLoading} className="border-[#E5E5E5] text-[#333333] hover:bg-[#FAFAFA]">
                      下一页
                    </Button>
                  </div>
                </div>;
          })()}
            </div>
          </div>}

        {/* 访问记录标签页 */}
        {activeTab === 'records' && <div>
            {/* 搜索和清理区域 */}
            <div className="mb-4">
              <div className="flex gap-2">
                <Input placeholder="搜索卡密（输入卡密后按回车或点击搜索）" value={recordSearchKeyword} onChange={e => setRecordSearchKeyword(e.target.value)} onKeyDown={e => {
              if (e.key === 'Enter') {
                // 搜索功能已通过实时过滤实现，无需额外操作
              }
            }} className="flex-1 bg-white border-[#E5E5E5] focus:border-[#333333] focus:ring-0" />
                <Button onClick={() => {}} disabled={isLoading} className="bg-[#333333] hover:bg-black text-white">
                  <Search className="w-4 h-4 mr-2" />
                  搜索
                </Button>
                {recordSearchKeyword && <Button variant="outline" onClick={() => setRecordSearchKeyword('')} className="border-[#E5E5E5] text-[#333333] hover:bg-[#FAFAFA]">
                    清空
                  </Button>}
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" onClick={handleCleanOldRecords} disabled={isLoading} className="border-[#E5E5E5] text-[#333333] hover:bg-[#FAFAFA]">
                  <Trash2 className="w-4 h-4 mr-2" />
                  清理10天前的记录
                </Button>
                <Button variant="outline" onClick={handleCleanAllRecords} disabled={isLoading} className="border-red-200 text-red-600 hover:bg-red-50">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  清理所有记录
                </Button>
              </div>
            </div>

            {/* 每页显示数量选择 */}
            <div className="mb-2">
              <Select value={recordsPageSize} onValueChange={value => {
            setRecordsPageSize(value);
            setRecordsCurrentPage(1);
          }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="每页显示" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">每页20条</SelectItem>
                  <SelectItem value="30">每页30条</SelectItem>
                  <SelectItem value="50">每页50条</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-white border border-[#E5E5E5] rounded overflow-hidden">
              <table className="min-w-full divide-y divide-[#E5E5E5]">
                <thead className="bg-[#F5F5F5]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#333333] uppercase tracking-wider">
                      用户IP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#333333] uppercase tracking-wider">
                      卡密
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#333333] uppercase tracking-wider">
                      生成昵称
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#333333] uppercase tracking-wider">
                      访问时间
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#E5E5E5]">
                  {(() => {
                // 根据搜索关键词过滤记录
                const filteredRecords = recordSearchKeyword ? accessRecords.filter(record => record.card_code && record.card_code.includes(recordSearchKeyword.trim())) : accessRecords;

                // 分页计算
                const pageSize = parseInt(recordsPageSize);
                const totalPages = Math.ceil(filteredRecords.length / pageSize);
                const startIndex = (recordsCurrentPage - 1) * pageSize;
                const endIndex = startIndex + pageSize;
                const currentPageRecords = filteredRecords.slice(startIndex, endIndex);
                if (filteredRecords.length === 0) {
                  return <tr key="no-data">
                          <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                            {recordSearchKeyword ? '未找到匹配的卡密记录' : '暂无数据'}
                          </td>
                        </tr>;
                }
                return currentPageRecords.map(record => <tr key={record._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                          {record.user_ip}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                          {record.card_code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                          {record.generated_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(record.access_time).toLocaleString('zh-CN')}
                        </td>
                      </tr>);
              })()}
                </tbody>
              </table>
            </div>

            {/* 分页控件 */}
            {(() => {
          const filteredRecords = recordSearchKeyword ? accessRecords.filter(record => record.card_code && record.card_code.includes(recordSearchKeyword.trim())) : accessRecords;
          const pageSize = parseInt(recordsPageSize);
          const totalPages = Math.ceil(filteredRecords.length / pageSize);
          if (totalPages <= 1) return null;
          return <div className="flex justify-center mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious onClick={() => {
                    if (recordsCurrentPage > 1) setRecordsCurrentPage(recordsCurrentPage - 1);
                  }} />
                      </PaginationItem>

                      {Array.from({
                  length: Math.min(5, totalPages)
                }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (recordsCurrentPage <= 3) {
                    pageNum = i + 1;
                  } else if (recordsCurrentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = recordsCurrentPage - 2 + i;
                  }
                  return <PaginationItem key={pageNum}>
                            <PaginationLink isActive={pageNum === recordsCurrentPage} onClick={() => setRecordsCurrentPage(pageNum)}>
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>;
                })}

                      {totalPages > 5 && <>
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                          <PaginationItem>
                            <PaginationLink isActive={recordsCurrentPage === totalPages} onClick={() => setRecordsCurrentPage(totalPages)}>
                              {totalPages}
                            </PaginationLink>
                          </PaginationItem>
                        </>}

                      <PaginationItem>
                        <PaginationNext onClick={() => {
                    if (recordsCurrentPage < totalPages) setRecordsCurrentPage(recordsCurrentPage + 1);
                  }} />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>;
        })()}
          </div>}
      </div>
    </div>;
}