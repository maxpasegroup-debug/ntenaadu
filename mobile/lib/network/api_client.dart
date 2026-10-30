import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_config.dart';

class NteApiException implements Exception {
  const NteApiException(this.code, this.statusCode);
  final String code;
  final int? statusCode;
}

class ApiClient {
  ApiClient({
    FlutterSecureStorage? secureStorage,
    String? apiBaseUrl,
    bool? releaseBuild,
  }) : _storage = secureStorage ?? const FlutterSecureStorage(),
       _configuredOrigin = apiBaseUrl ?? configuredNteApiBaseUrl,
       _isRelease = releaseBuild ?? kReleaseMode;

  static const _accessKey = 'nte_naadu.access_token';
  static const _refreshKey = 'nte_naadu.refresh_token';

  final FlutterSecureStorage _storage;
  final String _configuredOrigin;
  final bool _isRelease;
  Dio? _dio;
  Dio? _refreshDio;
  Future<bool>? _refreshInFlight;

  Dio get dio {
    if (_dio != null) return _dio!;
    final origin = resolveNteApiOrigin(_configuredOrigin, isRelease: _isRelease);
    final client = Dio(BaseOptions(
      baseUrl: '$origin/api/v1',
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 25),
      sendTimeout: const Duration(seconds: 20),
      headers: const {'Accept': 'application/json'},
    ));
    client.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        if (!_isPublicPath(options.path)) {
          final token = await _storage.read(key: _accessKey);
          if (token != null && token.isNotEmpty) options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final request = error.requestOptions;
        if (error.response?.statusCode != 401 || _isPublicPath(request.path) || request.extra['nteRetried'] == true) {
          handler.next(error);
          return;
        }
        final refreshed = await _refreshTokens();
        if (!refreshed) {
          await clearTokens();
          handler.next(error);
          return;
        }
        final token = await _storage.read(key: _accessKey);
        final retry = request.copyWith(
          headers: {...request.headers, 'Authorization': 'Bearer $token'},
          extra: {...request.extra, 'nteRetried': true},
        );
        try { handler.resolve(await client.fetch<dynamic>(retry)); }
        on DioException catch (retryError) { handler.next(retryError); }
      },
    ));
    _dio = client;
    return client;
  }

  bool _isPublicPath(String path) => path.startsWith('/auth/parents/registrations') ||
      path.startsWith('/auth/verification') || path == '/auth/sessions' ||
      path.startsWith('/auth/sessions/refresh') || path.startsWith('/auth/recovery-');

  Future<bool> _refreshTokens() {
    final pending = _refreshInFlight;
    if (pending != null) return pending;
    final completer = Completer<bool>();
    _refreshInFlight = completer.future;
    () async {
      try { completer.complete(await _performRefresh()); }
      catch (_) { completer.complete(false); }
      finally { _refreshInFlight = null; }
    }();
    return completer.future;
  }

  Future<bool> _performRefresh() async {
    final refresh = await _storage.read(key: _refreshKey);
    if (refresh == null || refresh.isEmpty) return false;
    final origin = resolveNteApiOrigin(_configuredOrigin, isRelease: _isRelease);
    final client = _refreshDio ??= Dio(BaseOptions(
      baseUrl: '$origin/api/v1',
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
    ));
    final response = await client.post<Map<String, dynamic>>('/auth/sessions/refresh', data: {'refreshToken': refresh});
    final access = response.data?['accessToken'];
    final nextRefresh = response.data?['refreshToken'];
    if (access is! String || nextRefresh is! String) return false;
    await _saveTokens(access, nextRefresh);
    return true;
  }

  Future<void> saveTokens(String access, String refresh) => _saveTokens(access, refresh);

  Future<bool> hasSessionToken() async => (await _storage.read(key: _refreshKey))?.isNotEmpty == true;

  Future<void> _saveTokens(String access, String refresh) async {
    await _storage.write(key: _accessKey, value: access);
    await _storage.write(key: _refreshKey, value: refresh);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }

  Future<void> signOut() async {
    try { await dio.delete<void>('/auth/sessions/current'); }
    finally { await clearTokens(); }
  }

  static NteApiException fromDio(DioException error) {
    final data = error.response?.data;
    final errorObject = data is Map ? data['error'] : null;
    final code = errorObject is Map && errorObject['code'] is String
        ? errorObject['code'] as String
        : error.response == null ? 'NETWORK_UNAVAILABLE' : 'SERVICE_ERROR';
    return NteApiException(code, error.response?.statusCode);
  }
}
