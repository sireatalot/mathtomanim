from manim import *

class LCSAnimation(Scene):
    def construct(self):
        # Input strings
        text1 = "ABCBDAB"
        text2 = "BDCABA"
        m, n = len(text1), len(text2)

        # Compute DP table
        dp = [[0]*(n+1) for _ in range(m+1)]
        for i in range(1, m+1):
            for j in range(1, n+1):
                if text1[i-1] == text2[j-1]:
                    dp[i][j] = dp[i-1][j-1] + 1
                else:
                    dp[i][j] = max(dp[i-1][j], dp[i][j-1])

        # Backtrack to find one LCS path
        path = []
        i, j = m, n
        while i > 0 and j > 0:
            if text1[i-1] == text2[j-1]:
                path.append((i, j))
                i -= 1
                j -= 1
            elif dp[i-1][j] >= dp[i][j-1]:
                i -= 1
            else:
                j -= 1
        path.reverse()

        # Display strings
        txt1 = Text(text1).to_edge(UP).shift(LEFT*2)
        txt2 = Text(text2).to_edge(LEFT).shift(DOWN*2)
        self.play(Write(txt1), Write(txt2))

        # Create grid of cells
        cell_size = 0.7
        cells = VGroup()
        for row in range(m+1):
            for col in range(n+1):
                rect = Square(side_length=cell_size, color=GRAY)
                rect.move_to(
                    LEFT*(n/2 - col)*cell_size +
                    DOWN*(m/2 - row)*cell_size
                )
                cells.add(rect)

        cells.shift(RIGHT*2 + DOWN*1)  # position grid near strings
        self.play(Create(cells))

        # Label first row with characters of text2
        col_labels = VGroup()
        for idx, ch in enumerate(" " + text2):
            label = Text(ch, font_size=24)
            label.move_to(cells[idx].get_center())
            col_labels.add(label)
        # Label first column with characters of text1
        row_labels = VGroup()
        for idx, ch in enumerate(" " + text1):
            label = Text(ch, font_size=24)
            label.move_to(cells[idx*(n+1)].get_center())
            row_labels.add(label)

        self.play(FadeIn(col_labels), FadeIn(row_labels))

        # Fill DP values cell by cell
        number_mobs = VGroup()
        for i in range(m+1):
            for j in range(n+1):
                if i == 0 or j == 0:
                    val = 0
                else:
                    val = dp[i][j]
                num = Text(str(val), font_size=24)
                num.move_to(cells[i*(n+1)+j].get_center())
                number_mobs.add(num)
                self.play(FadeIn(num), run_time=0.2)

        # Highlight LCS path
        highlight = always_redraw(lambda: Rectangle(
            width=cell_size, height=cell_size,
            stroke_width=4, color=YELLOW
        ).move_to(cells[path[0][0]*(n+1)+path[0][1]].get_center()))

        self.add(highlight)
        for (row, col) in path:
            target = cells[row*(n+1)+col].get_center()
            self.play(highlight.animate.move_to(target), run_time=0.4)

        # Show final LCS length
        lcs_len = dp[m][n]
        result = Text(f"LCS length = {lcs_len}", font_size=36, color=GREEN)
        result.next_to(cells, DOWN, buff=1)
        self.play(Write(result))
        self.wait(2)