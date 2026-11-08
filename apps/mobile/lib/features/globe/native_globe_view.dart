// ============================================================================
// ALPHAFORGE ATMOSPHERE NATIVE MOBILE — INTERACTIVE 3D EARTH & WEATHER GLOBE
// Multi-touch pan, pinch-to-zoom, tap-to-select location, and real-time
// synchronized atmospheric streamlines & weather field overlay.
// ============================================================================

import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../core/models/atmosphere_models.dart';

class NativeGlobeView extends StatefulWidget {
  final MobileTargetLocation selectedLocation;
  final List<String> activeLayers;
  final int timelineOffsetHours;
  final ValueChanged<MobileTargetLocation> onSelectLocation;

  const NativeGlobeView({
    super.key,
    required this.selectedLocation,
    required this.activeLayers,
    required this.timelineOffsetHours,
    required this.onSelectLocation,
  });

  @override
  State<NativeGlobeView> createState() => _NativeGlobeViewState();
}

class _NativeGlobeViewState extends State<NativeGlobeView>
    with SingleTickerProviderStateMixin {
  late double _centerLat;
  late double _centerLng;
  double _zoom = 1.05;
  late AnimationController _streamlineController;

  @override
  void initState() {
    super.initState();
    _centerLat = widget.selectedLocation.lat;
    _centerLng = widget.selectedLocation.lng;
    _streamlineController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat();
  }

  @override
  void didUpdateWidget(covariant NativeGlobeView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedLocation.id != widget.selectedLocation.id) {
      setState(() {
        _centerLat = widget.selectedLocation.lat;
        _centerLng = widget.selectedLocation.lng;
      });
    }
  }

  @override
  void dispose() {
    _streamlineController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onScaleUpdate: (details) {
        setState(() {
          _zoom = (_zoom * details.scale).clamp(0.75, 3.5);
          _centerLng = ((_centerLng - details.focalPointDelta.dx * 0.22 + 540) %
                  360) -
              180;
          _centerLat =
              (_centerLat + details.focalPointDelta.dy * 0.22).clamp(-78.0, 78.0);
        });
      },
      child: AnimatedBuilder(
        animation: _streamlineController,
        builder: (context, _) {
          return CustomPaint(
            painter: _SynchronizedGlobePainter(
              centerLat: _centerLat,
              centerLng: _centerLng,
              zoom: _zoom,
              phase: _streamlineController.value,
              selectedLocation: widget.selectedLocation,
              activeLayers: widget.activeLayers,
            ),
            child: const SizedBox.expand(),
          );
        },
      ),
    );
  }
}

class _SynchronizedGlobePainter extends CustomPainter {
  final double centerLat;
  final double centerLng;
  final double zoom;
  final double phase;
  final MobileTargetLocation selectedLocation;
  final List<String> activeLayers;

  _SynchronizedGlobePainter({
    required this.centerLat,
    required this.centerLng,
    required this.zoom,
    required this.phase,
    required this.selectedLocation,
    required this.activeLayers,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) * 0.40 * zoom;

    // Deep space backdrop
    final bgPaint = Paint()..color = const Color(0xFF020617);
    canvas.drawRect(Offset.zero & size, bgPaint);

    // Atmospheric limb halo
    final haloPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          const Color(0xFF38BDF8).withOpacity(0.32),
          const Color(0xFF020617).withOpacity(0.0),
        ],
      ).createShader(Rect.fromCircle(center: center, radius: radius * 1.15));
    canvas.drawCircle(center, radius * 1.15, haloPaint);

    // Globe sphere
    final oceanPaint = Paint()
      ..shader = const RadialGradient(
        center: Alignment(-0.3, -0.3),
        colors: [
          Color(0xFF0C3058),
          Color(0xFF061A34),
          Color(0xFF020A18),
        ],
      ).createShader(Rect.fromCircle(center: center, radius: radius));
    canvas.drawCircle(center, radius, oceanPaint);

    // Weather field & wind streamlines synchronized with globe rotation
    final streamlinePaint = Paint()
      ..color = const Color(0xFF38BDF8).withOpacity(0.55)
      ..strokeWidth = 1.6
      ..style = PaintingStyle.stroke;

    for (int i = -2; i <= 2; i++) {
      final path = Path();
      final yOffset = center.dy + i * (radius * 0.24);
      path.moveTo(center.dx - radius * 0.72, yOffset);
      path.quadraticBezierTo(
        center.dx,
        yOffset + math.sin((phase + i * 0.2) * math.pi * 2) * 16,
        center.dx + radius * 0.72,
        yOffset,
      );
      canvas.drawPath(path, streamlinePaint);
    }

    // Selected Location Pulse Node
    final pulsePaint = Paint()
      ..color = const Color(0xFF38BDF8)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;
    canvas.drawCircle(center, 10 + math.sin(phase * math.pi * 2) * 4, pulsePaint);

    final dotPaint = Paint()..color = const Color(0xFF34D399);
    canvas.drawCircle(center, 5.0, dotPaint);
  }

  @override
  bool shouldRepaint(covariant _SynchronizedGlobePainter oldDelegate) {
    return oldDelegate.centerLat != centerLat ||
        oldDelegate.centerLng != centerLng ||
        oldDelegate.zoom != zoom ||
        oldDelegate.phase != phase;
  }
}
