from manim import *
import numpy as np

class SineCosineScene(Scene):
    def construct(self):
        axes = Axes(
            x_range=[0, 2 * PI, PI / 2],
            y_range=[-1.5, 1.5, 0.5],
            x_length=10,
            y_length=4,
            axis_config={"color": WHITE},
            tips=False,
        )
        axes_labels = VGroup(
            axes.get_x_axis_label(Text("x")),
            axes.get_y_axis_label(Text("y")),
        )

        sine = axes.plot(lambda x: np.sin(x), color=BLUE)
        cosine = axes.plot(lambda x: np.cos(x), color=RED)

        sine_label = Text("sin").next_to(sine, UP, buff=0.2).set_color(BLUE)
        cosine_label = Text("cos").next_to(cosine, UP, buff=0.2).set_color(RED)

        self.play(Create(axes), Write(axes_labels))
        self.play(Create(sine), Write(sine_label))
        self.play(Create(cosine), Write(cosine_label))

        # trackers for moving points
        tracker_sin = ValueTracker(0)
        tracker_cos = ValueTracker(0)

        # moving dots
        dot_sin = Dot(color=BLUE).add_updater(
            lambda m: m.move_to(axes.c2p(tracker_sin.get_value(),
                                         np.sin(tracker_sin.get_value()))))
        dot_cos = Dot(color=RED).add_updater(
            lambda m: m.move_to(axes.c2p(tracker_cos.get_value(),
                                         np.cos(tracker_cos.get_value()))))

        # vertical lines from x‑axis to the curves
        line_sin = always_redraw(
            lambda: Line(
                axes.c2p(max(tracker_sin.get_value(), 0.001), 0),
                axes.c2p(tracker_sin.get_value(),
                         np.sin(tracker_sin.get_value())),
                color=BLUE,
            )
        )
        line_cos = always_redraw(
            lambda: Line(
                axes.c2p(max(tracker_cos.get_value(), 0.001), 0),
                axes.c2p(tracker_cos.get_value(),
                         np.cos(tracker_cos.get_value())),
                color=RED,
            )
        )

        self.add(dot_sin, dot_cos, line_sin, line_cos)

        self.play(
            tracker_sin.animate.set_value(2 * PI),
            tracker_cos.animate.set_value(2 * PI),
            run_time=6,
            rate_func=linear,
        )

        self.wait(2)