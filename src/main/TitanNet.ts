// 文件名: src/main/TitanNet.ts
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

export const titanFetch = async (url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> => {
  const { timeout = 8000, ...restOptions } = options;

  // 【新增】外部 AbortSignal 兼容：如果调用方已 abort，立刻拒绝
  if (restOptions.signal?.aborted) {
    throw new TypeError('Network request failed: AbortError');
  }

  // 将 HeadersInit 统一转换为 axios 需要的普通对象
  let axiosHeaders: Record<string, string> = {};
  if (restOptions.headers) {
    if (restOptions.headers instanceof Headers) {
      restOptions.headers.forEach((value, key) => {
        axiosHeaders[key] = value;
      });
    } else if (Array.isArray(restOptions.headers)) {
      for (const [key, value] of restOptions.headers) {
        axiosHeaders[key] = value;
      };
    } else {
      axiosHeaders = { ...(restOptions.headers as Record<string, string>) };
    }
  }
  axiosHeaders['User-Agent'] = 'TitanCore/2.0';

  const axiosConfig: AxiosRequestConfig = {
    url,
    method: (restOptions.method as any) || 'GET',
    headers: axiosHeaders,
    timeout,
    responseType: 'text',
    validateStatus: () => true,
    signal: restOptions.signal as any, // 【修复】AbortSignal 透传至 axios
  };

  if (restOptions.body) {
    axiosConfig.data = restOptions.body;
  }

  try {
    const res: AxiosResponse = await axios(axiosConfig);

    // 将 axios 响应包装为标准 Response，上层代码零改动
    const headerEntries: Record<string, string> = {};
    if (res.headers) {
      for (const [key, value] of Object.entries(res.headers)) {
        if (typeof value === 'string') {
          headerEntries[key] = value;
        } else if (Array.isArray(value)) {
          headerEntries[key] = value.join(', ');
        }
      }
    }

    return new Response(res.data, {
      status: res.status,
      statusText: res.statusText,
      headers: new Headers(headerEntries),
    });
  } catch (e: any) {
    const message = e.code ? `${e.code}: ${e.message}` : e.message;
    throw new TypeError(`Network request failed: ${message}`);
  }
};