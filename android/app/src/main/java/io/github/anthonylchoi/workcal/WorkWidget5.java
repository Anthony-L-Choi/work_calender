package io.github.anthonylchoi.workcal;

/** 5x5 홈 화면 위젯: 4x4(WorkWidget)와 같고 모든 글씨만 5/4배로 키운다 */
public class WorkWidget5 extends WorkWidget {
    @Override
    protected float scale() {
        return 1.25f;
    }
}
