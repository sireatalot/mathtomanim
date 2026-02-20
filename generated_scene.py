from manim import *

class NeuralNetworkScene(Scene):
    def construct(self):
        # Parameters
        input_count = 3
        hidden_count = 4
        output_count = 2
        neuron_radius = 0.3
        layer_spacing = 3
        neuron_spacing = 1

        # Create layers
        input_layer = VGroup(*[
            Circle(radius=neuron_radius, color=BLUE).add(Text(str(i+1), font_size=24))
            for i in range(input_count)
        ]).arrange(DOWN, buff=neuron_spacing).move_to(LEFT*layer_spacing)

        hidden_layer = VGroup(*[
            Circle(radius=neuron_radius, color=GREEN).add(Text(str(i+1), font_size=24))
            for i in range(hidden_count)
        ]).arrange(DOWN, buff=neuron_spacing).move_to(ORIGIN)

        output_layer = VGroup(*[
            Circle(radius=neuron_radius, color=RED).add(Text(str(i+1), font_size=24))
            for i in range(output_count)
        ]).arrange(DOWN, buff=neuron_spacing).move_to(RIGHT*layer_spacing)

        # Labels
        input_label = Text("Input", font_size=24).next_to(input_layer, UP, buff=0.5)
        hidden_label = Text("Hidden", font_size=24).next_to(hidden_layer, UP, buff=0.5)
        output_label = Text("Output", font_size=24).next_to(output_layer, UP, buff=0.5)

        # Add layers and labels
        self.play(FadeIn(input_layer), FadeIn(hidden_layer), FadeIn(output_layer),
                  FadeIn(input_label), FadeIn(hidden_label), FadeIn(output_label))
        self.wait(0.5)

        # Create connections
        connections = VGroup()
        for inp in input_layer:
            for hid in hidden_layer:
                conn = Arrow(start=inp.get_center(), end=hid.get_center(),
                             buff=neuron_radius, stroke_width=1, color=GRAY)
                connections.add(conn)
        for hid in hidden_layer:
            for out in output_layer:
                conn = Arrow(start=hid.get_center(), end=out.get_center(),
                             buff=neuron_radius, stroke_width=1, color=GRAY)
                connections.add(conn)

        self.play(FadeIn(connections, lag_ratio=0.01))
        self.wait(0.5)

        # Function to animate a signal traveling along a path
        def signal_dot(start, end, color):
            tracker = ValueTracker(0)
            dot = always_redraw(lambda: Dot(
                point=start + (end - start) * tracker.get_value(),
                radius=0.08,
                color=color
            ))
            return dot, tracker

        # Animate signals from each input neuron through hidden to output
        for i, inp in enumerate(input_layer):
            # Choose a hidden neuron to route through (simple round-robin)
            hid = hidden_layer[i % hidden_count]
            out = output_layer[i % output_count]

            # Signal from input to hidden
            dot1, tr1 = signal_dot(inp.get_center(), hid.get_center(), YELLOW)
            self.add(dot1)
            self.play(tr1.animate.set_value(1), run_time=0.8, rate_func=linear)
            self.remove(dot1)

            # Signal from hidden to output
            dot2, tr2 = signal_dot(hid.get_center(), out.get_center(), ORANGE)
            self.add(dot2)
            self.play(tr2.animate.set_value(1), run_time=0.8, rate_func=linear)
            self.remove(dot2)

            self.wait(0.3)

        self.wait(1)