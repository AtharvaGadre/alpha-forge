import 'package:flutter_test/flutter_test.dart';
import 'package:alphaforge_atmosphere_mobile/app/atmosphere_app.dart';
import 'package:alphaforge_atmosphere_mobile/core/api/atmosphere_api_client.dart';

void main() {
  testWidgets(
    'AlphaForge Atmosphere Mobile renders synchronized globe and weather-to-market trade ideas',
    (WidgetTester tester) async {
      await tester.pumpWidget(const AlphaForgeAtmosphereMobileApp());
      await tester.pumpAndSettle();

      expect(find.text('AlphaForge Atmosphere'), findsOneWidget);
      expect(
        find.textContaining('Predicted Weather Effects on Financial Markets'),
        findsOneWidget,
      );
      expect(find.textContaining('KC=F'), findsWidgets);
      expect(find.text('ARGON'), findsOneWidget);
    },
  );

  test(
    'Fallback Brazil trade idea contains KC=F Arabica Coffee and weather evidence',
    () {
      final ideas = AtmosphereApiClient.getFallbackTradeIdeas('BR');
      expect(ideas, isNotEmpty);
      expect(ideas.first.countryIso2, equals('BR'));
      expect(
        ideas.first.affectedInstruments.any((i) => i.ticker == 'KC=F'),
        isTrue,
      );
    },
  );
}
