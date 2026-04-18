// @ts-ignore;
import React, { useState, useEffect } from 'react';
// @ts-ignore;
import { useToast, Input, Button } from '@/components/ui';

export default function AdminLogin(props) {
  const {
    $w
  } = props;
  const {
    toast
  } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 简单的管理员账户验证（硬编码）
  const ADMIN_CREDENTIALS = {
    username: 'lydj219',
    password: 'lyj520..'
  };
  const handleLogin = async e => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        title: '请输入用户名和密码',
        variant: 'destructive'
      });
      return;
    }
    setIsLoading(true);
    try {
      // 验证管理员账户
      if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        // 设置会话标记
        sessionStorage.setItem('adminSession', 'true');
        toast({
          title: '登录成功'
        });

        // 跳转到管理主页
        $w.utils.navigateTo({
          pageId: 'admin',
          params: {}
        });
      } else {
        toast({
          title: '用户名或密码错误',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: '登录失败',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  return <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-medium text-center text-[#333333] mb-8">管理员登录</h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Input type="text" placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-[#F5F5F5] border-[#E5E5E5] focus:border-[#333333] focus:ring-0 text-[#333333] placeholder:text-gray-400" />
          </div>
          
          <div>
            <Input type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#F5F5F5] border-[#E5E5E5] focus:border-[#333333] focus:ring-0 text-[#333333] placeholder:text-gray-400" />
          </div>
          
          <Button type="submit" disabled={isLoading} className="w-full bg-[#333333] hover:bg-black text-white py-3">
            {isLoading ? '登录中...' : '登录'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button type="button" onClick={() => $w.utils.navigateTo({
          pageId: 'home',
          params: {}
        })} className="text-sm text-gray-500 hover:text-[#333333]">
            返回首页
          </button>
        </div>
      </div>
    </div>;
}