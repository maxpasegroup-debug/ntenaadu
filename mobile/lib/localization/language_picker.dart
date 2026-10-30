import 'package:flutter/material.dart';

import 'languages.dart';
import 'locale_controller.dart';

class LanguagePickerButton extends StatelessWidget {
  const LanguagePickerButton({super.key, required this.controller, this.compact = false, this.onLanguageChanged});

  final LocaleController controller;
  final bool compact;
  final Future<void> Function(String languageCode)? onLanguageChanged;

  @override
  Widget build(BuildContext context) {
    final current = languageFor(controller.locale)!;
    return Semantics(
      button: true,
      label: controller.text('language.title'),
      child: OutlinedButton.icon(
        onPressed: () => showLanguagePicker(context, controller, onLanguageChanged: onLanguageChanged),
        icon: const Icon(Icons.language),
        label: compact ? Text(current.nativeName) : Text('${current.nativeName} · ${current.englishName}'),
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFF263A30),
          side: const BorderSide(color: Color(0xFF4C8B69)),
          minimumSize: const Size(48, 48),
        ),
      ),
    );
  }
}

Future<void> showLanguagePicker(
  BuildContext context,
  LocaleController controller, {
  Future<void> Function(String languageCode)? onLanguageChanged,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: const Color(0xFFF6F3EC),
    builder: (context) => _LanguagePickerSheet(controller: controller, onLanguageChanged: onLanguageChanged),
  );
}

class _LanguagePickerSheet extends StatefulWidget {
  const _LanguagePickerSheet({required this.controller, this.onLanguageChanged});

  final LocaleController controller;
  final Future<void> Function(String languageCode)? onLanguageChanged;

  @override
  State<_LanguagePickerSheet> createState() => _LanguagePickerSheetState();
}

class _LanguagePickerSheetState extends State<_LanguagePickerSheet> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = _search.text.trim().toLowerCase();
    final filtered = appLanguages.where((language) =>
      language.englishName.toLowerCase().contains(query) ||
      language.nativeName.toLowerCase().contains(query));
    final strings = widget.controller;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 4, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height * 0.76,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(strings.text('language.title'), style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              TextField(
                controller: _search,
                onChanged: (_) => setState(() {}),
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search),
                  hintText: strings.text('language.search'),
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: ListView.builder(
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final language = filtered.elementAt(index);
                    final selected = language.locale.languageCode == widget.controller.locale.languageCode;
                    return Semantics(
                      enabled: language.available,
                      selected: selected,
                      child: ListTile(
                        enabled: language.available,
                        title: Directionality(
                          textDirection: _directionFor(language.locale.languageCode),
                          child: Text(language.nativeName),
                        ),
                        subtitle: Text(language.englishName),
                        trailing: language.available
                            ? selected ? const Icon(Icons.check_circle, color: Color(0xFF4C8B69)) : null
                            : Text(strings.text('language.comingSoon'), style: Theme.of(context).textTheme.bodySmall),
                        onTap: language.available
                            ? () async {
                                await widget.controller.setLocale(language.locale);
                                try {
                                  await widget.onLanguageChanged?.call(language.locale.languageCode);
                                } catch (_) {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                      content: Text(widget.controller.text('language.syncFailed')),
                                    ));
                                  }
                                }
                                if (context.mounted) Navigator.of(context).pop();
                              }
                            : null,
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  TextDirection _directionFor(String code) =>
      const {'ur', 'sd', 'ks'}.contains(code) ? TextDirection.rtl : TextDirection.ltr;
}
