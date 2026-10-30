const _blockedHostFragments = <String>['happinotes.online', 'happinotes-production', 'happinotes'];
const _localHosts = <String>{'localhost', '127.0.0.1', '::1', '10.0.2.2'};
const _nonProductionLabels = <String>{'dev', 'development', 'test', 'testing', 'staging', 'sandbox'};

String resolveNteApiOrigin(String configuredUrl, {required bool isRelease}) {
  final value = configuredUrl.trim();
  if (value.isEmpty) throw const FormatException('NTE_API_BASE_URL is not configured.');
  final uri = Uri.tryParse(value);
  if (uri == null || !uri.hasScheme || !uri.hasAuthority || uri.host.isEmpty ||
      uri.userInfo.isNotEmpty || uri.hasQuery || uri.hasFragment ||
      (uri.path.isNotEmpty && uri.path != '/')) {
    throw const FormatException('NTE_API_BASE_URL must be an HTTP(S) origin without credentials or a path.');
  }
  final scheme = uri.scheme.toLowerCase();
  final host = uri.host.toLowerCase().replaceFirst(RegExp(r'\.$'), '');
  if (scheme != 'http' && scheme != 'https') throw const FormatException('NTE_API_BASE_URL must use HTTP or HTTPS.');
  if (_blockedHostFragments.any(host.contains)) {
    throw const FormatException('HappiNotes API hosts are not permitted for NTE Naadu.');
  }
  if (isRelease && scheme != 'https') throw const FormatException('Release API origins must use HTTPS.');
  if (!isRelease && scheme == 'http' && !_localHosts.contains(host)) {
    throw const FormatException('Non-release HTTP is permitted only for local development hosts.');
  }
  if (!isRelease && !_localHosts.contains(host) &&
      !host.split(RegExp(r'[.-]')).any(_nonProductionLabels.contains)) {
    throw const FormatException('Non-release API origin must be local or explicitly marked non-production.');
  }
  return uri.replace(path: '').toString().replaceFirst(RegExp(r'/$'), '');
}

const configuredNteApiBaseUrl = String.fromEnvironment('NTE_API_BASE_URL');
